/** Shared contracts. Skill source and credentials stay on the server. */
export type CoverMode = 'with-text' | 'wordless';
export type CoverRatio = '2.35:1' | '1:1' | '4:3' | '9:16';
export type CoverOptions = { mode: CoverMode; styleId?: string; title: string; aspectRatio: CoverRatio; instruction: string; previousPrompt?: string; feedback?: string; generationRatio?: string };
export type CoverStyle = { id: string; name: string; description: string; conditional: boolean };
export type CoverRecommendation = { id: string; reason: string };
export type CoverCheck = { status: 'pass' | 'fail' | 'unverified' | 'not_applicable'; evidence: string };
export const COVER_CHECKS = ['text', 'content', 'action', 'style', 'readability', 'preservation'] as const;
export type CoverReview = { status: 'passed' | 'failed' | 'unverified'; decision: 'retain' | 'local_fix' | 'reconstruct'; evidence: string; feedback: string; observedText: string; checks: Record<typeof COVER_CHECKS[number], CoverCheck>; imageSha256: string };
export type CoverRecord = { options: CoverOptions; prompt: string; review: CoverReview; width: number; height: number; requestedRatio: string; generationRatio: string; skillVersion: string };

export function parseModelJson(text: string): Record<string, unknown> {
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型返回格式无法识别');
  return value;
}
export function parseCoverRecommendations(text: string, styles: CoverStyle[]): CoverRecommendation[] {
  const raw = parseModelJson(text).recommendations;
  if (!Array.isArray(raw)) throw new Error('没有返回风格推荐，请重试');
  const result: CoverRecommendation[] = [];
  for (const item of raw) {
    if (!item || !styles.some(style => style.id === item.id) || typeof item.reason !== 'string' || !item.reason.trim() || result.some(entry => entry.id === item.id)) continue;
    result.push({ id: item.id, reason: item.reason.trim().slice(0, 180) });
  }
  if (result.length !== 3) throw new Error('风格推荐不完整，请重试或直接选择风格');
  return result;
}
export function parseCoverPrompt(text: string) {
  const prompt = parseModelJson(text).prompt;
  if (typeof prompt !== 'string' || prompt.trim().length < 30 || prompt.length > 10000) throw new Error('画面构思不完整，请重新生成');
  return prompt.trim();
}
/** Missing checks never become passes. Only layout line breaks may differ in locked text. */
export function parseCoverReview(text: string, options: CoverOptions, imageSha256: string): CoverReview {
  const raw = parseModelJson(text);
  const checks = {} as CoverReview['checks'];
  for (const key of COVER_CHECKS) {
    const entry = (raw.checks as Record<string, unknown> | undefined)?.[key] as Partial<CoverCheck> | undefined;
    const valid = entry && ['pass', 'fail', 'unverified', 'not_applicable'].includes(entry.status || '') && typeof entry.evidence === 'string' && entry.evidence.trim();
    checks[key] = valid ? { status: entry.status!, evidence: entry.evidence!.trim().slice(0, 800) } : { status: 'unverified', evidence: '模型未提供可核对的看图依据' };
    if (checks[key].status === 'not_applicable' && key !== 'preservation') checks[key] = { status: 'unverified', evidence: '本项需要实际看图判断' };
  }
  const observedText = typeof raw.observedText === 'string' ? raw.observedText : '';
  const expectedText = options.mode === 'with-text' ? options.title : '';
  if (typeof raw.observedText !== 'string') checks.text = { status: 'unverified', evidence: '缺少逐字观察记录' };
  else if (observedText.replace(/[\r\n]/g, '') !== expectedText.replace(/[\r\n]/g, '')) checks.text = { status: 'fail', evidence: options.mode === 'wordless' ? '实际图片出现了文字或标识' : '实际观察文字与锁定标题不一致' };
  const evidence = typeof raw.evidence === 'string' ? raw.evidence.trim().slice(0, 1200) : '';
  const decision = raw.decision === 'retain' || raw.decision === 'local_fix' || raw.decision === 'reconstruct' ? raw.decision : 'reconstruct';
  const values = Object.values(checks);
  const missing = values.some(check => check.status === 'unverified') || !evidence;
  const failed = values.some(check => check.status === 'fail') || decision !== 'retain';
  return { status: missing ? 'unverified' : failed ? 'failed' : 'passed', decision, evidence,
    feedback: typeof raw.feedback === 'string' ? raw.feedback.trim().slice(0, 2000) : '', observedText, checks, imageSha256 };
}
export function checkCoverRatio(width: number, height: number, generationRatio: string) {
  if (!/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(generationRatio)) return false;
  const [w, h] = generationRatio.split(':').map(Number);
  if (w <= 0 || h <= 0) return false;
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height <= 40000000 && Number.isFinite(w / h) && Math.abs((width / height) / (w / h) - 1) <= .02;
}
/** A proxy may honor the composition ratio while ignoring a native size parameter. */
export function resolveCoverRatio(width: number, height: number, requested: string, native: string) {
  return checkCoverRatio(width, height, requested) ? requested : native;
}
