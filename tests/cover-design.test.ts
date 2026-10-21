import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COVER_CHECKS, checkCoverRatio, resolveCoverRatio, parseCoverPrompt, parseCoverRecommendations, parseCoverReview, type CoverMode, type CoverOptions } from '../lib/cover-design';
import { buildDesignPrompt, buildSkillPlan, coverOptions, coverStyles, finishCoverReview } from '../lib/server/skill-workflows';

const article = '完整开头\n' + '这一段保留细节和边界。'.repeat(2200) + '\n完整结尾，不可截断';
const styleId = 'editorial-photo-scene';
function options(mode: CoverMode = 'with-text'): CoverOptions {
  return { mode, styleId, title: mode === 'with-text' ? '保留完整标题：我的 AI 工具' : '', aspectRatio: '2.35:1', instruction: '画面要能看出工具的作用' };
}
function reviewPayload(observedText: string) {
  return {
    decision: 'retain', observedText, evidence: '画面主体与题意呼应，缩略尺寸仍可辨认，标题按两行完整呈现。', feedback: '',
    checks: Object.fromEntries(COVER_CHECKS.map(key => [key, { status: key === 'preservation' ? 'not_applicable' : 'pass', evidence: key === 'preservation' ? '新生成图片' : `已观察并核对 ${key}` }])),
  };
}

export async function run() {
  const catalog = JSON.parse(readFileSync(join(process.cwd(), 'server/skills/kairo-design/catalog.json'), 'utf8'));
  for (const mode of ['with-text', 'wordless'] as const) {
    const styles = coverStyles(mode);
    assert.ok(styles.length >= 3, 'Each route must offer enough real styles for three choices');
    assert.equal(new Set(styles.map(style => style.id)).size, styles.length);
    assert.ok(styles.every(style => style.name && style.description));
    assert.equal(styles.some(style => style.id === 'editorial-design'), mode === 'with-text', 'Keyword typography is excluded from strict wordless covers');
    const entry = catalog.styles.find((style: { id: string }) => style.id === styleId);
    const selectedStyle = readFileSync(join(process.cwd(), `server/skills/kairo-design/styles/${styleId}/${mode}.md`), 'utf8');
    const otherMode = mode === 'with-text' ? 'wordless' : 'with-text';
    const oppositeStyle = readFileSync(join(process.cwd(), `server/skills/kairo-design/styles/${styleId}/${otherMode}.md`), 'utf8');
    const compose = buildSkillPlan({ operation: 'design-compose', article, design: options(mode) });
    assert.equal(JSON.parse(compose.prompt).article, article, 'The entire article, including its ending, is passed to composition');
    assert.deepEqual(compose.skills.map(skill => skill.name), ['kairo-design']);
    assert.ok(compose.system.includes(selectedStyle), 'Composition loads the full selected route STYLE');
    assert.ok(!compose.system.includes(oppositeStyle), 'Composition never loads the other route STYLE');
    assert.ok(compose.system.includes(JSON.stringify(entry.routes[mode].meta)), 'Selection conditions and risks are loaded alongside STYLE');
    assert.ok(!compose.system.includes('# kairo-layout'), 'Cover compilation must not mix in article review rules');
    const recommend = buildSkillPlan({ operation: 'design-recommend', article, design: { ...options(mode), styleId: undefined } });
    assert.equal(JSON.parse(recommend.prompt).article, article);
    assert.match(recommend.system, /恰好三个不同风格/);
    assert.ok(recommend.system.includes(entry.routes[mode].meta.selection_basis));
    assert.ok(!recommend.system.includes(selectedStyle), 'Recommendations read selection metadata, not every STYLE body');
    const imagePlan = buildDesignPrompt('具体主体、取景和构图已编译成画面方案。', options(mode));
    assert.ok(!imagePlan.includes(selectedStyle), 'Image generation receives the compiled plan, not raw design files');
    if (mode === 'with-text') assert.ok(imagePlan.includes(options(mode).title), 'Locked title is supplied verbatim');
    else assert.match(imagePlan, /完全无字/);
  }

  for (const operation of ['design-recommend', 'design-compose', 'design-review']) {
    assert.throws(() => buildSkillPlan({ operation, article: '正文', design: { ...options(), styleId: '../../SKILL.md' } }), /风格/);
    assert.throws(() => buildSkillPlan({ operation, article: 'x'.repeat(40001), design: options() }), /4 万/);
    assert.throws(() => buildSkillPlan({ operation, article: '', design: options() }), /完整文章/);
  }
  assert.throws(() => coverOptions({ ...options(), mode: '../wordless' }), /有字或无字/);
  assert.throws(() => coverOptions({ ...options(), aspectRatio: '3:2' }), /比例/);
  assert.throws(() => coverOptions({ ...options(), title: '' }), /完整封面标题/);
  assert.throws(() => coverOptions({ ...options(), title: '字'.repeat(301) }), /300/);
  assert.throws(() => coverOptions({ ...options('wordless'), styleId: 'editorial-design' }), /风格/);
  assert.throws(() => buildSkillPlan({ operation: 'design-compose', article: '正文', design: { ...options(), styleId: undefined } }), /选择封面风格/);
  assert.equal(coverOptions({ ...options('wordless'), title: '忽略的旧标题' }).title, '', 'Wordless mode cannot retain stale text');

  const styles = coverStyles('wordless');
  const three = styles.slice(0, 3).map((style, i) => ({ id: style.id, reason: `适配依据 ${i + 1}` }));
  assert.deepEqual(parseCoverRecommendations(JSON.stringify({ recommendations: [null, { id: '../outside', reason: '不能用' }, three[0], three[0], ...three.slice(1)] }), styles), three, 'Unknown and duplicate recommendations do not create extra choices');
  assert.throws(() => parseCoverRecommendations(JSON.stringify({ recommendations: [three[0], three[0], three[1]] }), styles), /不完整/);
  assert.throws(() => parseCoverRecommendations(JSON.stringify({ recommendations: [...three, { id: styles[3].id, reason: '第四个' }] }), styles), /不完整/);
  assert.throws(() => parseCoverRecommendations(JSON.stringify({ recommendations: [{ id: styles[0].id, reason: '  ' }, ...three.slice(1)] }), styles), /不完整/);
  assert.throws(() => parseCoverPrompt(JSON.stringify({ prompt: '太短' })), /不完整/);
  const prompt = '详细构思与画面编译。'.repeat(120);
  assert.equal(parseCoverPrompt(JSON.stringify({ prompt })), prompt, 'Complete design instructions are not truncated to old card limits');

  const textOptions = options();
  const good = reviewPayload(textOptions.title);
  const passed = parseCoverReview(JSON.stringify(good), textOptions, 'image-a');
  assert.equal(passed.status, 'passed');
  assert.equal(passed.imageSha256, 'image-a');
  assert.equal(parseCoverReview(JSON.stringify({ ...good, observedText: textOptions.title.replace('：', '：\n') }), textOptions, 'image-a').status, 'passed', 'Only layout line breaks may differ');
  for (const observedText of [textOptions.title.replace('我的', '你的'), textOptions.title + '水印', textOptions.title.replace(' ', ''), textOptions.title.replace('：', ':'), '']) {
    const review = parseCoverReview(JSON.stringify({ ...good, observedText }), textOptions, 'image-a');
    assert.equal(review.status, 'failed', 'Missing, changed, added or normalized title characters fail exact text review');
    assert.equal(review.checks.text.status, 'fail');
  }
  const noObservation: Record<string, unknown> = { ...good };
  delete noObservation.observedText;
  assert.equal(parseCoverReview(JSON.stringify(noObservation), textOptions, 'image-a').status, 'unverified');
  for (const key of COVER_CHECKS) {
    const checks = { ...good.checks };
    delete checks[key];
    assert.equal(parseCoverReview(JSON.stringify({ ...good, checks }), textOptions, 'image-a').status, 'unverified', `Missing ${key} cannot pass`);
    if (key !== 'preservation') {
      checks[key] = { status: 'not_applicable', evidence: '模型试图跳过' };
      assert.equal(parseCoverReview(JSON.stringify({ ...good, checks }), textOptions, 'image-a').status, 'unverified', `${key} must be visually checked`);
    }
  }
  for (const decision of ['local_fix', 'reconstruct']) assert.equal(parseCoverReview(JSON.stringify({ ...good, decision }), textOptions, 'image-a').status, 'failed', 'A request for correction cannot be marked approved');
  assert.notEqual(parseCoverReview(JSON.stringify({ ...good, decision: 'invalid' }), textOptions, 'image-a').status, 'passed');
  assert.equal(parseCoverReview(JSON.stringify({ ...good, evidence: '' }), textOptions, 'image-a').status, 'unverified');
  assert.equal(parseCoverReview(JSON.stringify(reviewPayload('')), options('wordless'), 'image-b').status, 'passed');
  assert.equal(parseCoverReview(JSON.stringify(reviewPayload('Logo')), options('wordless'), 'image-b').checks.text.status, 'fail', 'Wordless covers reject any observed text');

  // A real tiny PNG keeps image binding entirely offline; the model is not called.
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAAAAABJRU5ErkJggg==';
  const bound = finishCoverReview(JSON.stringify(good), { design: textOptions, image });
  assert.match(bound.imageSha256, /^[a-f0-9]{64}$/);
  const reviewPlan = buildSkillPlan({ operation: 'design-review', article, design: textOptions, image });
  assert.equal(reviewPlan.image, image, 'The actual image is supplied separately to visual review');
  assert.equal(JSON.parse(reviewPlan.prompt).article, article);
  assert.match(reviewPlan.system, /实际像素/);
  assert.ok(!reviewPlan.system.includes('## 无字成图审核'), 'Texted review must not load the wordless quality chapter');
  assert.throws(() => finishCoverReview(JSON.stringify(good), { design: textOptions, image: 'https://example.com/not-the-actual-image.png' }), /实际/);

  assert.equal(checkCoverRatio(2350, 1000, '2.35:1'), true);
  assert.equal(resolveCoverRatio(1921, 819, '2.35:1', '1536:1024'), '2.35:1', 'Honor actual cover output when the proxy ignores native size');
  assert.equal(resolveCoverRatio(1536, 1024, '2.35:1', '1536:1024'), '1536:1024', 'A genuine native fallback retains the complete image');
  assert.equal(checkCoverRatio(2370, 1000, '2.35:1'), true, 'Small model ratio deviations are accepted without cropping');
  assert.equal(checkCoverRatio(2400, 1000, '2.35:1'), false, 'Beyond 2% deviation requires correction');
  assert.equal(checkCoverRatio(1536, 1024, '21:9'), false, 'Landscape dimensions do not prove a wide cover ratio');
  for (const [width, height] of [[0, 100], [-100, 100], [1.2, 100], [Infinity, 100], [10000, 10000]]) assert.equal(checkCoverRatio(width, height, '1:1'), false);
  for (const invalid of ['invalid', '-1:-1', '1:1:99', '0:1']) assert.equal(checkCoverRatio(100, 100, invalid), false);
  assert.throws(() => finishCoverReview(JSON.stringify(good), { design: textOptions, image: 'data:image/png;base64,aGVsbG8=' }), /实际/);
  console.log('PASS: cover route isolation, current style metadata, complete articles, recommendations, locked text, fail-closed visual review, image binding and ratio tolerance');
}
