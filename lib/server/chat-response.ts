export class UpstreamChatStreamError extends Error {
  constructor(readonly category: string) { super('UpstreamStreamError'); this.name = 'UpstreamChatStreamError'; }
}

/** Collect a complete upstream SSE reply without accepting truncated model output. */
export async function readChatResponse(response: Response): Promise<string> {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const raw = await response.json();
    const text = raw?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('InvalidChatResponse');
    return text;
  }
  if (!response.body) throw new Error('MissingChatStream');
  const reader = response.body.getReader();
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
    if (choice?.finish_reason === 'length') throw new Error('ChatOutputLimit');
    if (choice?.finish_reason === 'content_filter') throw new Error('ChatContentFiltered');
    if (choice?.finish_reason === 'stop') completed = true;
    if (text.length > 200000) throw new Error('ChatOutputLimit');
  }
  try {
    while (true) {
      const part = await reader.read();
      buffer += decoder.decode(part.value, { stream: !part.done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2);
      }
      if (part.done) { if (buffer.trim()) event(buffer); break; }
      if (buffer.length > 1000000) throw new Error('ChatStreamFrameLimit');
    }
    if (!completed || !text.trim()) throw new Error('IncompleteChatStream');
    return text;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
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
export async function upstreamFailureCategory(response: Response) {
  let text = '';
  const reader = response.body?.getReader();
  if (reader) {
    try {
      while (text.length < 12000) {
        const part = await reader.read(); if (part.done) break;
        text += new TextDecoder().decode(part.value).slice(0, 12000 - text.length);
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  return classifyFailureText(text);
}
