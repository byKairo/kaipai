
import { aiFetch } from './ai-transport';
export type AiProviderId = 'OpenRouter' | 'OpenAI' | 'Anthropic' | 'Gemini' | 'DeepSeek' | 'Qwen' | 'Kimi' | 'Grok' | 'Custom';
export type AiRequest = { provider: AiProviderId; apiKey: string; endpoint?: string; model?: string; adapter?: 'openai-chat' | 'openai-responses'; system?: string; prompt: string; operation?: 'full' | 'layout' | 'images' | 'title' | 'review' | 'design-recommend' | 'design-compose' | 'design-review'; design?: import('./cover-design').CoverOptions; image?: string; article?: string; preferences?: string; action?: 'plan' | 'test' };
export type AiResult = { ok: true; text: string; model: string; review?: import('./cover-design').CoverReview } | { ok: false; error: string };

export const AI_PROVIDER_DEFAULTS: Record<Exclude<AiProviderId, 'Custom'>, { endpoint: string; model: string }> = {
  OpenRouter: { endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: '' },
  OpenAI: { endpoint: 'https://api.openai.com/v1/chat/completions', model: '' },
  Anthropic: { endpoint: 'https://api.anthropic.com/v1/chat/completions', model: '' },
  Gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: '' },
  DeepSeek: { endpoint: 'https://api.deepseek.com/chat/completions', model: '' },
  Qwen: { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: '' },
  Kimi: { endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: '' },
  Grok: { endpoint: 'https://api.x.ai/v1/chat/completions', model: '' },
};

export async function requestAi(input: AiRequest, signal?: AbortSignal): Promise<AiResult> {
  try {
    const response = await aiFetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), cache: 'no-store', signal });
    const result = await response.json();
    if (!response.ok || !result?.ok) return { ok: false, error: typeof result?.error === 'string' ? result.error : `请求失败（${response.status}）` };
    return { ok: true, text: String(result.text || ''), model: String(result.model || ''), review: result.review };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '无法连接本地 API 服务' }; }
}
