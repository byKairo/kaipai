import type { AiProviderId } from './providers';
export type DiscoveredModel = { id: string; name: string };

export function identifyApiAddress(input: string): { baseUrl: string; provider: AiProviderId } {
  const url = new URL(input.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('请填写不含密钥和查询参数的 API 地址');
  const providers: Record<string, AiProviderId> = {
    'api.openai.com': 'OpenAI', 'api.anthropic.com': 'Anthropic', 'openrouter.ai': 'OpenRouter',
    'generativelanguage.googleapis.com': 'Gemini', 'api.deepseek.com': 'DeepSeek', 'dashscope.aliyuncs.com': 'Qwen',
    'api.moonshot.cn': 'Kimi', 'api.moonshot.ai': 'Kimi', 'api.x.ai': 'Grok',
  };
  const provider = providers[url.hostname] || 'Custom';
  url.pathname = url.pathname.replace(/\/(chat\/completions|responses|images\/generations|models)\/?$/, '').replace(/\/$/, '');
  if (!url.pathname || url.pathname === '/') url.pathname = provider === 'Gemini' ? '/v1beta/openai' : provider === 'Qwen' ? '/compatible-mode/v1' : '/v1';
  return { baseUrl: url.toString().replace(/\/$/, ''), provider };
}

export function modelKind(id: string): 'text' | 'image' | 'other' {
  if (/embedding|rerank|audio|speech|tts|whisper|video|seedance|sora|veo/i.test(id)) return 'other';
  if (/image|imagen|dall-e|flux|seedream|recraft|ideogram|aurora|wanx/i.test(id)) return 'image';
  return /gpt|gemini|claude|deepseek|qwen|kimi|moonshot|grok|llama|mistral|chat/i.test(id) ? 'text' : 'other';
}

export function recommendModels(models: DiscoveredModel[], current: { text: string; image: string }) {
  const rank = (id: string) => (/flash|mini|haiku/i.test(id) ? 30 : 0) + (/gemini|gpt|claude/i.test(id) ? 20 : 0) - (/preview|experimental|deprecated/i.test(id) ? 10 : 0);
  const sorted = [...models].sort((a, b) => rank(b.id) - rank(a.id) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  return {
    text: current.text || sorted.find(item => modelKind(item.id) === 'text')?.id || '',
    image: current.image || sorted.find(item => modelKind(item.id) === 'image')?.id || '',
  };
}
