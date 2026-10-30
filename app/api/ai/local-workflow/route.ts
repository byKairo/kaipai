import { NextRequest } from 'next/server';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
import { buildSkillPlan, buildDesignPrompt, finishCoverReview } from '../../../../lib/server/skills';
export const runtime = 'nodejs';
/** Prompt preparation and review validation only. Never contacts the user's API. */
export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 17000000);
    if ('apiKey' in body) return privateJson({ ok: false, error: '此接口不接收 API Key' }, 400);
    if (body.phase === 'review') {
      if (typeof body.text !== 'string' || body.text.length > 200000) throw new Error('审核内容无效');
      return privateJson({ ok: true, review: finishCoverReview(body.text, body) });
    }
    if (body.phase === 'image') {
      if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000) throw new Error('画面要求为空或过长');
      return privateJson({ ok: true, prompt: buildDesignPrompt(body.prompt, body.design) });
    }
    if (body.phase !== 'text') throw new Error('请求类型无效');
    return privateJson({ ok: true, ...buildSkillPlan(body) });
  } catch (error) { return privateJson({ ok: false, error: error instanceof Error ? error.message : '任务准备失败' }, 400); }
}
