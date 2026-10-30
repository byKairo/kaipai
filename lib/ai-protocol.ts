/** Shared wire formats only. Credentials, endpoint validation and transport stay with each caller. */
export function buildTextRequestBody(input: {
  provider?: string; model: string; adapter: 'openai-chat' | 'openai-responses';
  system: string; prompt: string; image?: string; maxOutputTokens: number; streaming?: boolean;
}) {
  const { provider, model, system, prompt, image, maxOutputTokens } = input;
  if (input.adapter === 'openai-responses') return {
    model, instructions: system,
    input: image ? [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image }] }] : prompt,
    max_output_tokens: maxOutputTokens, stream: false,
  };
  const openAiReasoning = provider === 'OpenAI' && /^gpt-[56]/.test(model);
  return {
    model, messages: [
      { role: openAiReasoning ? 'developer' : 'system', content: system },
      { role: 'user', content: image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image, detail: 'high' } }] : prompt },
    ],
    ...(provider === 'Kimi' || openAiReasoning ? { max_completion_tokens: maxOutputTokens } : { max_tokens: maxOutputTokens }),
    ...(provider === 'Kimi' && model === 'kimi-k3' ? { reasoning_effort: 'low' } : {}),
    stream: Boolean(input.streaming),
  };
}

export function buildImageRequestBody(input: { model: string; prompt: string; adapter: 'openai-images' | 'antigravity-gemini-image-chat'; aspectRatio?: string }) {
  const { model, prompt, adapter } = input;
  const aspectRatio = ['2.35:1', '1:1', '4:3', '9:16'].includes(input.aspectRatio || '') ? input.aspectRatio! : '';
  const nativeRatio = aspectRatio === '2.35:1' ? '21:9' : aspectRatio;
  if (adapter === 'antigravity-gemini-image-chat') return {
    body: { model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'], ...(nativeRatio ? { image_config: { aspect_ratio: nativeRatio } } : {}), stream: false },
    generationRatio: nativeRatio,
  };
  const dallE = /^dall-e-3/.test(model);
  const sized = dallE || /^gpt-image/.test(model);
  const size = aspectRatio === '1:1' ? '1024x1024' : aspectRatio === '9:16' ? dallE ? '1024x1792' : '1024x1536' : dallE ? '1792x1024' : '1536x1024';
  return {
    body: { model, prompt, n: 1, ...(aspectRatio ? sized ? { size } : { aspect_ratio: nativeRatio } : {}) },
    // An omitted size is chosen by the provider; do not claim a known ratio.
    generationRatio: dallE && aspectRatio === '1:1' ? '1:1' : aspectRatio && sized ? size.replace('x', ':') : nativeRatio,
  };
}

export function pickOpenAiImageSrc(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const image = value as Record<string, unknown>;
  const base64 = typeof image.b64_json === 'string' ? image.b64_json : typeof image.image_base64 === 'string' ? image.image_base64 : '';
  if (base64) return `data:${typeof image.media_type === 'string' ? image.media_type : typeof image.mime_type === 'string' ? image.mime_type : 'image/png'};base64,${base64}`;
  if (typeof image.url === 'string') return image.url;
  if (typeof image.image_url === 'string') return image.image_url;
  if (image.image_url && typeof image.image_url === 'object' && 'url' in image.image_url && typeof image.image_url.url === 'string') return image.image_url.url;
  return '';
}
