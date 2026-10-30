import { boundedResponseChunks, readResponseJson, RESPONSE_LIMITS } from '../response-body';
export class UpstreamChatStreamError extends Error {
  constructor(readonly category: string) { super('UpstreamStreamError'); this.name = 'UpstreamChatStreamError'; }
}

/** Collect a complete upstream SSE reply without accepting truncated model output. */
export async function readChatResponse(response: Response): Promise<string> {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const raw = await readResponseJson(response, RESPONSE_LIMITS.text);
    if (raw?.error) throw new UpstreamChatStreamError(classifyFailureText(JSON.stringify(raw.error)));
    assertChatFinish(raw?.choices?.[0]?.finish_reason);
    const text = raw?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('InvalidChatResponse');
    if (text.length > 200000) throw new Error('ChatOutputLimit');
    return text;
  }
  if (!response.body) throw new Error('MissingChatStream');
  const decoder = new TextDecoder();
  let buffer = '', text = '', completed = false;
  function event(block: string) {
    const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') { completed = true; return; }
    const chunk = JSON.parse(data);
    if (chunk.error) throw new UpstreamChatStreamError(classifyFailureText(JSON.stringify(chunk.error)));
    const choice = chunk.choices?.[0];
    if (typeof choice?.delta?.content === 'string') text += choice.delta.content;
    assertChatFinish(choice?.finish_reason);
    if (choice?.finish_reason === 'stop') completed = true;
    if (text.length > 200000) throw new Error('ChatOutputLimit');
  }
  for await (const chunk of boundedResponseChunks(response, RESPONSE_LIMITS.text)) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2);
    }
    if (buffer.length > 1000000) throw new Error('ChatStreamFrameLimit');
  }
  buffer += decoder.decode();
  if (buffer.trim()) event(buffer);
  if (!completed || !text.trim()) throw new Error('IncompleteChatStream');
  return text;
}

function assertChatFinish(reason: unknown) {
  if (reason === 'length') throw new Error('ChatOutputLimit');
  if (reason === 'content_filter') throw new Error('ChatContentFiltered');
}

/** Some compatible services omit status; explicit incomplete/error states are never accepted. */
export async function readResponsesResponse(response: Response): Promise<string> {
  const raw = await readResponseJson(response, RESPONSE_LIMITS.text);
  if (raw?.error) throw new UpstreamChatStreamError(classifyFailureText(JSON.stringify(raw.error)));
  if (raw?.incomplete_details || (raw?.status != null && raw.status !== 'completed')) throw new Error('IncompleteChatStream');
  const output = Array.isArray(raw?.output) ? raw.output : [];
  if (output.some((item: { status?: unknown }) => item?.status != null && item.status !== 'completed')) throw new Error('IncompleteChatStream');
  const text = typeof raw?.output_text === 'string' && raw.output_text ? raw.output_text
    : output.flatMap((item: { content?: unknown }) => Array.isArray(item?.content) ? item.content : [])
      .map((item: { text?: unknown }) => typeof item?.text === 'string' ? item.text : '').join('');
  if (!text.trim()) throw new Error('InvalidChatResponse');
  if (text.length > 200000) throw new Error('ChatOutputLimit');
  return text;
}

/** Only fixed categories are logged; never upstream bodies, article text or credentials. */
function classifyFailureText(text: string) {
  if (/no.{0,30}(channel|capacity)|无可用|没有可用|渠道.*不可用/i.test(text)) return 'no_available_channel';
  if (/rate.limit|quota|resource.exhausted|限流|余额|额度|too.many.requests/i.test(text)) return 'rate_or_quota';
  if (/unsupported|invalid.param|max_tokens|max_completion_tokens|image_url|不支持|参数/i.test(text)) return 'request_compatibility';
  if (/timeout|timed.out|超时/i.test(text)) return 'upstream_timeout';
  if (/overload|unavailable|过载|繁忙/i.test(text)) return 'overloaded';
  if (/cloudflare|bad.gateway|error.code:.?50[0234]/i.test(text)) return 'gateway_failure';
  return 'unclassified';
}
export async function upstreamFailureCategory(response: Response, timeoutMs = 1500) {
  let text = '';
  const reader = response.body?.getReader();
  if (reader) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs); });
    const decoder = new TextDecoder();
    try {
      while (text.length < 12000) {
        const part = await Promise.race([reader.read(), deadline]); if (!part || part.done) break;
        text += decoder.decode(part.value, { stream: true }).slice(0, 12000 - text.length);
      }
    } catch { /* An error-body failure must not hide the upstream HTTP status. */ }
    finally {
      clearTimeout(timer);
      // Cancelling a broken upstream can itself stall; error reporting must remain bounded.
      void reader.cancel().catch(() => {}); reader.releaseLock();
    }
  }
  return classifyFailureText(text);
}
