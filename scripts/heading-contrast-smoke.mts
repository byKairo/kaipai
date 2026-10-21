import { markdownToWechat } from '../lib/wechat-html.ts';
import { findStyle } from '../lib/styles.ts';

function hexLum(hex: string): number {
  const raw = hex.trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(full.slice(0, 2), 16));
  const g = channel(parseInt(full.slice(2, 4), 16));
  const b = channel(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const L1 = hexLum(a), L2 = hexLum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const md = `# 产品定义与设计命题\n\n## 第一章 范围\n\n### 1.1 一句话定义\n\n正文段落。\n`;

const cases: Array<{ id: string; accent?: string }> = [
  { id: 'edu' },
  { id: 'edu', accent: '#ffe566' },
  { id: 'tech' },
  { id: 'knowledge' },
  { id: 'pixelpost' },
  { id: 'corp' },
  { id: 'business' },
  { id: 'boldneo', accent: '#ffd27a' },
];

let failed = 0;
for (const c of cases) {
  const style = findStyle(c.id);
  const accent = c.accent ?? style.accent;
  const html = markdownToWechat(md, accent, '#fff07a', c.id, 24, '', {});
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
  const h3 = html.match(/<h3 style="([^"]*)"/)?.[1] ?? '';
  const chip = h1.match(/background-color:(#[0-9a-fA-F]{3,8});color:(#[0-9a-fA-F]{3,8})/);
  const h3Color = h3.match(/(?:^|;)color:(#[0-9a-fA-F]{3,8})/)?.[1];
  const paper = style.paper;
  const label = `${c.id}${c.accent ? '@' + c.accent : ''}`;

  if (chip) {
    const ratio = contrast(chip[1], chip[2]);
    const ok = ratio >= 3;
    console.log(`${label} H1 chip bg=${chip[1]} ink=${chip[2]} contrast=${ratio.toFixed(2)} ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) failed++;
  } else {
    const eye = h1.match(/color:(#[0-9a-fA-F]{3,8});text-align:left/)?.[1];
    if (eye) {
      const ratio = contrast(eye, paper);
      const ok = ratio >= 2.8;
      console.log(`${label} H1 eyebrow ink=${eye} vs paper=${paper} contrast=${ratio.toFixed(2)} ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) failed++;
    } else {
      console.log(`${label} H1 no chip/eyebrow (ok if empty label)`);
    }
  }
  if (h3Color) {
    const ratio = contrast(h3Color, paper);
    const ok = ratio >= 3;
    console.log(`${label} H3 color=${h3Color} vs paper=${paper} contrast=${ratio.toFixed(2)} ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) failed++;
  } else {
    console.log(`${label} H3 color MISSING FAIL`);
    failed++;
  }
  if (c.accent === '#ffe566' && h3Color && h3Color.toLowerCase() === '#ffe566') {
    console.log(`${label} H3 still washed accent FAIL`);
    failed++;
  }
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILURES`);
if (failed) throw new Error(`${failed} heading contrast failures`);
