import { NextRequest } from 'next/server';
import { coverStyles, skillVersions } from '../../../../lib/server/skills';
import { privateJson } from '../../../../lib/server/request';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode');
  if (mode !== 'with-text' && mode !== 'wordless') return privateJson({ ok: false, error: '请选择有字或无字' }, 400);
  return privateJson({ ok: true, styles: coverStyles(mode), version: skillVersions().find(item => item.name === 'kairo-design')?.version });
}
