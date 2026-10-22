import app from 'vinext/server/fetch-handler';
import { limitApiRequest, type ApiRateLimiter } from './lib/server/rate-limit';
export * from 'vinext/server/fetch-handler';
export default {
  async fetch(request: Request, env: { KAIPAI_API_RATE_LIMITER: ApiRateLimiter }, ctx: unknown) {
    const blocked = await limitApiRequest(request, env.KAIPAI_API_RATE_LIMITER);
    if (blocked) return blocked;
    return app.fetch(request, env, ctx);
  },
};
