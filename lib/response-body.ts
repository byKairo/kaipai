/** Limits apply to decoded network bytes, before strings or JSON objects are allocated. */
export const RESPONSE_LIMITS = {
  text: 8 * 1024 * 1024,
  models: 8 * 1024 * 1024,
  modelPages: 16 * 1024 * 1024,
  image: 36 * 1024 * 1024, // Includes base64 overhead for the existing 24 MiB image limit.
  reference: 20 * 1024 * 1024,
} as const;

export class UpstreamResponseLimitError extends Error {
  constructor() { super('模型服务返回的数据过大，请缩小输出后重试'); this.name = 'UpstreamResponseLimitError'; }
}

export type ResponseBudget = { remaining: number };

export async function* boundedResponseChunks(response: Response, maxBytes: number, budget?: ResponseBudget) {
  const reader = response.body?.getReader();
  if (!reader) return;
  let size = 0;
  try {
    if (Number(response.headers.get('content-length')) > Math.min(maxBytes, budget?.remaining ?? maxBytes)) throw new UpstreamResponseLimitError();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (budget) budget.remaining -= value.byteLength;
      if (size > maxBytes || (budget && budget.remaining < 0)) throw new UpstreamResponseLimitError();
      yield value;
    }
  } finally {
    // A broken upstream's cancellation promise must not hold the request open.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readResponseText(response: Response, maxBytes: number, budget?: ResponseBudget) {
  const decoder = new TextDecoder();
  const parts: string[] = [];
  const pending = new Uint8Array(65536);
  let length = 0;
  for await (const chunk of boundedResponseChunks(response, maxBytes, budget)) {
    // Coalesce tiny network chunks without retaining per-chunk strings or repeatedly joining them.
    for (let offset = 0; offset < chunk.byteLength;) {
      const take = Math.min(pending.length - length, chunk.byteLength - offset);
      pending.set(chunk.subarray(offset, offset + take), length);
      offset += take;
      length += take;
      if (length === pending.length) {
        parts.push(decoder.decode(pending, { stream: true }));
        length = 0;
      }
    }
  }
  parts.push(decoder.decode(pending.subarray(0, length)));
  return parts.join('');
}

export async function readResponseJson(response: Response, maxBytes: number, budget?: ResponseBudget) {
  return JSON.parse(await readResponseText(response, maxBytes, budget));
}
