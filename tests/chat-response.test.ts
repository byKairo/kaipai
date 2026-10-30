import assert from 'node:assert/strict';
import { readChatResponse, readResponsesResponse, upstreamFailureCategory } from '../lib/server/chat-response';
export async function run() {
  function stream(text: string) {
    const bytes = new TextEncoder().encode(text);
    return new Response(new ReadableStream({ start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  }
  const chunk = (content: string, finish_reason: string | null = null) => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason }] })}\r\n\r\n`;
  assert.equal(await readChatResponse(stream(': keepalive\r\n\r\n' + chunk('中文') + chunk('回复', 'stop') + 'data: [DONE]\r\n\r\n')), '中文回复');
  assert.equal(await readChatResponse(new Response(JSON.stringify({ choices: [{ message: { content: '非流回退' } }] }))), '非流回退');
  for (const [finish_reason, error] of [['length', /ChatOutputLimit/], ['content_filter', /ChatContentFiltered/]] as const) {
    await assert.rejects(readChatResponse(Response.json({ choices: [{ message: { content: '未完成的半句' }, finish_reason }] })), error);
  }
  assert.equal(await readChatResponse(Response.json({ choices: [{ message: { content: '完整回复' }, finish_reason: 'stop' }] })), '完整回复');
  assert.equal(await readResponsesResponse(Response.json({ status: 'completed', output: [{ status: 'completed', content: [{ type: 'output_text', text: '完整' }, { type: 'output_text', text: '回复' }] }] })), '完整回复');
  assert.equal(await readResponsesResponse(Response.json({ output_text: '兼容回复' })), '兼容回复');
  for (const status of ['incomplete', 'failed', 'cancelled', 'in_progress', 'queued']) {
    await assert.rejects(readResponsesResponse(Response.json({ status, output_text: '部分回复' })), /IncompleteChatStream/);
  }
  await assert.rejects(readResponsesResponse(Response.json({ output_text: '部分回复', incomplete_details: { reason: 'max_output_tokens' } })), /IncompleteChatStream/);
  await assert.rejects(readResponsesResponse(Response.json({ status: 'completed', output: [{ status: 'incomplete', content: [{ text: '部分回复' }] }] })), /IncompleteChatStream/);
  await assert.rejects(readResponsesResponse(Response.json({ status: 'completed', error: { message: 'quota' }, output_text: '部分回复' })), /UpstreamStreamError/);
  await assert.rejects(readChatResponse(stream(chunk('{"prompt":"半截'))), /IncompleteChatStream/);
  await assert.rejects(readChatResponse(stream(chunk('半截', 'length') + 'data: [DONE]\n\n')), /ChatOutputLimit/);
  await assert.rejects(readChatResponse(stream('data: {"error":{"message":"private detail"}}\n\n')), /UpstreamStreamError/);
  assert.equal(await upstreamFailureCategory(new Response('{"error":{"message":"no available channel for model"}}')), 'no_available_channel');
  assert.equal(await upstreamFailureCategory(new Response('Rate limit exceeded')), 'rate_or_quota');
  assert.equal(await upstreamFailureCategory(new Response('unsupported image_url parameter')), 'request_compatibility');
  assert.equal(await upstreamFailureCategory(new Response('private unclassified detail')), 'unclassified');
  let cancelled = false;
  const stalled = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('rate limit')); },
    cancel() { cancelled = true; return new Promise<void>(() => {}); },
  }), { status: 502 });
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      upstreamFailureCategory(stalled, 20),
      new Promise<never>((_, reject) => { watchdog = setTimeout(() => reject(new Error('Error body deadline did not finish')), 1000); }),
    ]);
    assert.equal(result, 'rate_or_quota');
    assert.ok(cancelled, 'A stalled response must be cancelled without awaiting a stalled cancellation');
  } finally { clearTimeout(watchdog); }
  assert.equal(await upstreamFailureCategory(new Response(new ReadableStream({ start(controller) { controller.error(new Error('broken upstream')); } }))), 'unclassified');
  console.log('PASS: complete Chat/Responses replies, truncation refusal, safe bounded error-body reads');
}
