import assert from 'node:assert/strict';
import { readChatResponse, upstreamFailureCategory } from '../lib/server/chat-response';
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
  await assert.rejects(readChatResponse(stream(chunk('{"prompt":"半截'))), /IncompleteChatStream/);
  await assert.rejects(readChatResponse(stream(chunk('半截', 'length') + 'data: [DONE]\n\n')), /ChatOutputLimit/);
  await assert.rejects(readChatResponse(stream('data: {"error":{"message":"private detail"}}\n\n')), /UpstreamStreamError/);
  assert.equal(await upstreamFailureCategory(new Response('{"error":{"message":"no available channel for model"}}')), 'no_available_channel');
  assert.equal(await upstreamFailureCategory(new Response('Rate limit exceeded')), 'rate_or_quota');
  assert.equal(await upstreamFailureCategory(new Response('unsupported image_url parameter')), 'request_compatibility');
  assert.equal(await upstreamFailureCategory(new Response('private unclassified detail')), 'unclassified');
  console.log('PASS: SSE UTF-8 frames, complete responses, truncation refusal and safe failure categories');
}
