import assert from 'node:assert/strict';
import { readResponseJson, readResponseText, RESPONSE_LIMITS, UpstreamResponseLimitError } from '../lib/response-body';
import { readChatResponse, readResponsesResponse } from '../lib/server/chat-response';

export async function run() {
  const bytes = new TextEncoder().encode('{"text":"中文🙂"}');
  const split = new Response(new ReadableStream({ start(controller) {
    for (const byte of Array.from(bytes)) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } }));
  assert.deepEqual(await readResponseJson(split, bytes.length), { text: '中文🙂' });
  for (const headers of [{}, { 'content-length': '1' }] as Record<string, string>[]) {
    let cancelled = false;
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(33));
    }, cancel() { cancelled = true; return new Promise<void>(() => {}); } }), { headers });
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    try {
      await assert.rejects(Promise.race([
        readResponseJson(response, 32),
        new Promise<never>((_, reject) => { watchdog = setTimeout(() => reject(new Error('Cancellation stalled')), 500); }),
      ]), UpstreamResponseLimitError);
    } finally { clearTimeout(watchdog); }
    assert.ok(cancelled);
    assert.equal(response.body?.locked, false);
  }
  const budget = { remaining: 6 };
  assert.equal(await readResponseText(new Response('123'), 4, budget), '123');
  await assert.rejects(readResponseText(new Response('4567'), 4, budget), UpstreamResponseLimitError);
  // Extra metadata must be rejected before JSON parsing, even with a short valid answer.
  for (const read of [readChatResponse, readResponsesResponse]) {
    await assert.rejects(read(Response.json({ choices: [{ message: { content: '正常回复' } }], output_text: '正常回复', unused: 'x'.repeat(RESPONSE_LIMITS.text) })), UpstreamResponseLimitError);
  }
  // SSE comment frames carry no output text, but must still consume the byte budget.
  let pulls = 0;
  let cancelled = false;
  const event = new TextEncoder().encode(':' + 'x'.repeat(65532) + '\n\n');
  const sse = new Response(new ReadableStream({ pull(controller) {
    pulls++; controller.enqueue(event);
  }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(readChatResponse(sse), UpstreamResponseLimitError);
  assert.ok(cancelled && pulls < 132, 'Stop consuming the endless upstream once the total byte budget is exceeded');
  // Preserve the existing 24 MiB image allowance including base64 and JSON overhead.
  const base64 = 'A'.repeat(24 * 1024 * 1024 / 3 * 4);
  const image = await readResponseJson(Response.json({ data: [{ b64_json: base64 }] }), RESPONSE_LIMITS.image);
  assert.equal(image.data[0].b64_json.length, base64.length);
  await assert.rejects(readResponseJson(new Response('{broken'), 32), SyntaxError);
  console.log('PASS: upstream byte limits, misleading headers, cumulative budgets, cancellation, SSE, Unicode and 24 MiB images');
}
