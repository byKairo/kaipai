/** Offline-provider HTTP acceptance. Never reads user credentials or contacts a real model. */
const http = require('node:http');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const appUrl = process.env.WORKSPACE_URL || 'http://127.0.0.1:3003';
const app = new URL(appUrl);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(app.hostname), 'Run only against the local website');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=';
const image = `data:image/png;base64,${png}`;
const imageHash = createHash('sha256').update(Buffer.from(png, 'base64')).digest('hex');
const syntheticKey = 'cover-http-test-only-no-real-secret';
const article = '封面协议验证文章\n' + '完整阅读正文，保留具体事实及条件。'.repeat(700) + '\n这是真实传入请求的完整结尾。';
const styleId = 'editorial-photo-scene';
const options = (mode = 'with-text') => ({ mode, styleId, title: mode === 'with-text' ? '保留标题：我的 AI 工具' : '', aspectRatio: '2.35:1', instruction: '本地模拟供应商，仅验证协议。' });
const compiledPrompt = '具体画面构思：采用叙事摄影，以侧向自然光表现人物与日常物件之间的关系，按当前路线和标题安排构图。';
const checks = ['text', 'content', 'action', 'style', 'readability', 'preservation'];
function reviewPayload(observedText) {
  return { decision: 'retain', observedText, evidence: '这是确定性模拟响应，不是实际视觉判断。', feedback: '', checks: Object.fromEntries(checks.map(key => [key, { status: key === 'preservation' ? 'not_applicable' : 'pass', evidence: '仅验证审核字段传输和校验' }])) };
}

async function main() {
  const calls = [];
  let scenario;
  let mockFailure;
  const server = http.createServer(async (req, res) => {
    try {
      assert.equal(req.headers.authorization, `Bearer ${syntheticKey}`);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.ok(scenario, 'Every provider call must have an expected scenario');
      const responses = req.url === '/v1/responses';
      const chat = req.url === '/v1/chat/completions';
      const generating = req.url === '/v1/images/generations';
      assert.ok(responses || chat || generating, `Unexpected provider route ${req.url}`);
      const call = { path: req.url, scenario: scenario.name, actualImageAttached: false };
      calls.push(call);
      if (scenario.kind === 'redirect') {
        res.statusCode = 302;
        res.setHeader('Location', '/v1/redirect-must-not-be-followed');
        res.end('Redirect refused by caller');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      if (generating) {
        assert.equal(scenario.kind, 'image');
        assert.ok(body.prompt.includes(compiledPrompt));
        assert.match(body.prompt, /不裁切、不拉伸/);
        if (scenario.mode === 'with-text') assert.ok(body.prompt.includes(options('with-text').title));
        else assert.match(body.prompt, /完全无字/);
        assert.ok(!body.prompt.includes('# kairo-design'), 'Image model receives a compiled plan, not raw skill files');
        if (body.model === 'image-test') assert.equal(body.aspect_ratio, '21:9');
        else if (body.model === 'gpt-image-1') assert.equal(body.size, '1536x1024');
        else assert.fail('Unexpected test image model');
        return res.end(JSON.stringify({ data: [{ b64_json: png }] }));
      }
      const system = responses ? body.instructions : body.messages[0].content;
      const content = responses ? Array.isArray(body.input) ? body.input[0].content : body.input : body.messages[1].content;
      let prompt;
      if (scenario.kind === 'review') {
        assert.ok(Array.isArray(content), 'Visual review requires a multimodal message');
        const textPart = content.find(part => part.type === (responses ? 'input_text' : 'text'));
        const imagePart = content.find(part => part.type === (responses ? 'input_image' : 'image_url'));
        assert.ok(textPart && imagePart);
        assert.equal(responses ? imagePart.image_url : imagePart.image_url.url, image, 'Actual image bytes must reach both provider protocols');
        if (chat) assert.equal(imagePart.image_url.detail, 'high');
        prompt = textPart.text;
        call.actualImageAttached = true;
        assert.match(system, /实际像素/);
      } else prompt = content;
      const user = JSON.parse(prompt);
      assert.equal(user.article, article, 'Article must remain complete through the HTTP route');
      assert.equal(user.design.mode, scenario.mode);
      assert.ok(!system.includes('# kairo-layout'));
      assert.ok(system.includes(scenario.mode === 'with-text' ? '# 有字封面工作流' : '## 无字创作工作流'));
      if (scenario.kind === 'compose') assert.ok(system.includes(scenario.mode === 'with-text' ? '# 叙事摄影：有字' : '# 叙事摄影：无字'));
      const text = JSON.stringify(scenario.reply);
      if (body.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        const split = Math.floor(text.length / 2);
        for (const content of [text.slice(0, split), text.slice(split)]) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
        return res.end('data: [DONE]\n\n');
      }
      res.end(JSON.stringify(responses ? { output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } : { choices: [{ message: { content: text } }] }));
    } catch (error) {
      mockFailure = error;
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Local mock assertion failed' } }));
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const send = async (route, body, expectedStatus = 200) => {
      const response = await fetch(`${appUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: app.origin }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      if (mockFailure) throw mockFailure;
      assert.equal(response.status, expectedStatus, `${route}: ${JSON.stringify(payload)}`);
      assert.equal(payload.ok, expectedStatus === 200, `${route}: ${JSON.stringify(payload)}`);
      return payload;
    };
    const sealed = await send('/api/credentials/seal', { provider: 'Custom', baseUrl, apiKey: syntheticKey });
    assert.ok(typeof sealed.credential === 'string' && sealed.credential !== syntheticKey);
    assert.ok(!sealed.credential.includes(syntheticKey), 'The credential route must not return raw test keys');
    const common = { provider: 'Custom', apiKey: sealed.credential, endpoint: baseUrl, model: 'text-test' };
    const catalogs = {};
    for (const mode of ['with-text', 'wordless']) {
      const response = await fetch(`${appUrl}/api/ai/design?mode=${mode}`, { signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      assert.equal(response.status, 200, JSON.stringify(payload));
      assert.equal(payload.ok, true);
      assert.ok(Array.isArray(payload.styles) && payload.styles.length >= 3);
      assert.match(payload.version, /^[a-f0-9]{12}$/);
      assert.ok(payload.styles.some(style => style.id === 'anthropic-brand-editorial'), 'Latest catalog must be deployed');
      assert.equal(payload.styles.some(style => style.id === 'editorial-design'), mode === 'with-text');
      catalogs[mode] = payload.styles;
      scenario = { name: `recommend-${mode}`, kind: 'recommend', mode, reply: { recommendations: payload.styles.slice(0, 3).map(style => ({ id: style.id, reason: `适合本次文章的 ${style.name}` })) } };
      const recommended = await send('/api/ai', { ...common, operation: 'design-recommend', article, design: { ...options(mode), styleId: undefined } });
      assert.equal(JSON.parse(recommended.text).recommendations.length, 3);
      scenario = { name: `compose-${mode}`, kind: 'compose', mode, reply: { prompt: compiledPrompt } };
      const composed = await send('/api/ai', { ...common, operation: 'design-compose', article, design: options(mode) });
      assert.equal(JSON.parse(composed.text).prompt, compiledPrompt);
    }
    const invalidMode = await fetch(`${appUrl}/api/ai/design?mode=../wordless`, { signal: AbortSignal.timeout(15000) });
    assert.equal(invalidMode.status, 400);

    for (const adapter of ['openai-chat', 'openai-responses']) {
      for (const mode of ['with-text', 'wordless']) {
        scenario = { name: `review-${adapter}-${mode}`, kind: 'review', mode, reply: reviewPayload(options(mode).title) };
        const reviewed = await send('/api/ai', { ...common, adapter, operation: 'design-review', article, design: options(mode), image });
        assert.equal(reviewed.review.status, 'passed', 'Complete mock records can pass schema checks; this is not a real aesthetic result');
        assert.equal(reviewed.review.imageSha256, imageHash);
      }
    }
    scenario = { name: 'review-title-mismatch', kind: 'review', mode: 'with-text', reply: reviewPayload('标题被模型换成了另一句话') };
    const changedTitle = await send('/api/ai', { ...common, operation: 'design-review', article, design: options(), image });
    assert.equal(changedTitle.review.status, 'failed');
    assert.equal(changedTitle.review.checks.text.status, 'fail');
    const missing = reviewPayload(options('with-text').title);
    delete missing.checks.readability;
    scenario = { name: 'review-missing-check', kind: 'review', mode: 'with-text', reply: missing };
    const incomplete = await send('/api/ai', { ...common, operation: 'design-review', article, design: options(), image });
    assert.equal(incomplete.review.status, 'unverified');
    assert.equal(incomplete.review.checks.readability.status, 'unverified');
    scenario = { name: 'review-correction-required', kind: 'review', mode: 'with-text', reply: { ...reviewPayload(options('with-text').title), decision: 'local_fix', feedback: '修正可读性' } };
    const correction = await send('/api/ai', { ...common, operation: 'design-review', article, design: options(), image });
    assert.equal(correction.review.status, 'failed');

    for (const mode of ['with-text', 'wordless']) {
      scenario = { name: `generate-${mode}`, kind: 'image', mode };
      const generated = await send('/api/ai/image', { provider: 'Custom', apiKey: sealed.credential, baseUrl, model: 'image-test', adapter: 'openai-images', aspectRatio: '2.35:1', prompt: compiledPrompt, design: options(mode) });
      assert.equal(generated.src, image);
      assert.equal(generated.generationRatio, '21:9');
    }
    scenario = { name: 'generate-supported-native-size', kind: 'image', mode: 'wordless' };
    const native = await send('/api/ai/image', { provider: 'Custom', apiKey: sealed.credential, baseUrl, model: 'gpt-image-1', adapter: 'openai-images', aspectRatio: '2.35:1', prompt: compiledPrompt, design: options('wordless') });
    assert.equal(native.generationRatio, '1536:1024', 'Report actual requested native size rather than pretending exact cover ratio');
    for (const route of ['/api/ai', '/api/ai/image']) {
      scenario = { name: `redirect-refused-${route}`, kind: 'redirect', mode: 'wordless' };
      const beforeRedirect = calls.length;
      await send(route, route === '/api/ai'
        ? { ...common, operation: 'design-compose', article, design: options('wordless') }
        : { provider: 'Custom', apiKey: sealed.credential, baseUrl, model: 'image-test', aspectRatio: '2.35:1', prompt: compiledPrompt, design: options('wordless') }, 502);
      assert.equal(calls.length, beforeRedirect + 1, 'Never forward credentials or follow a provider redirect');
    }
    const beforeInvalid = calls.length;
    await send('/api/ai', { ...common, operation: 'design-compose', article, design: { ...options(), styleId: '../../SKILL.md' } }, 400);
    await send('/api/ai/image', { provider: 'Custom', apiKey: sealed.credential, baseUrl, model: 'image-test', prompt: compiledPrompt, design: { ...options('wordless'), styleId: 'editorial-design' } }, 400);
    assert.equal(calls.length, beforeInvalid, 'Invalid styles must be rejected before contacting a provider');
    console.log(JSON.stringify({ ok: true, website: appUrl, provider: 'local mock only', credentialSealing: true, currentCatalog: true, completeArticle: true, routeIsolation: true, actualImageBytesInBothProtocols: true, titleMismatchRejected: true, missingCheckUnverified: true, correctionNotApproved: true, imageDesignConstraints: true, generationRatioReported: true, invalidStyleRejectedBeforeProvider: true, realModelVisualQualityVerified: false, redirectsNotFollowed: true, calls }, null, 2));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
