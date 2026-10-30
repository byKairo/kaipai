import { useMemo, useRef, useState } from 'react';
import type { SidebarModel } from './controller';
import { FOLLOW_DEFAULTS } from './shared';
import { buildFollowBlock } from '../../lib/follow-composer';
import { findStyle } from '../../lib/styles';
import { markdownToWechat } from '../../lib/wechat-html';
import ui from './components-panel.module.css';

const templates = [['minimal','简洁文字'],['brand','主题色块'],['card','轻卡片'],['neo','粗线条'],['qr','二维码'],['avatar','作者头像'],['split','左图右文'],['account','账号介绍']] as const;

export function FollowComposer({ model }: { model: SidebarModel }) {
  const { p, follow, followFields, mediaMeta, setFollowField, chooseFollow, insertFollow } = model;
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const media = mediaMeta[follow];
  const needsQr = follow === 'qr' && !followFields[3].trim();
  const invalidLink = Boolean(followFields[4].trim()) && !/^https:\/\/[^\s]+$/i.test(followFields[4].trim());
  const preview = useMemo(() => {
    const style = findStyle(p.styleId);
    const block = buildFollowBlock(follow, followFields, FOLLOW_DEFAULTS[follow] || FOLLOW_DEFAULTS.minimal);
    const html = markdownToWechat(block, p.accent, p.markerColor, p.styleId, 12, '', { ...style?.reading, fontSize:p.fontSize, lineHeight:p.lineHeight, paper:p.resolvedPaper, padY:0 });
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}img{max-width:100%}</style><body>${html}</body></html>`;
  }, [follow, followFields, p.styles, p.accent, p.markerColor, p.styleId, p.fontSize, p.lineHeight, p.resolvedPaper]);
  return <div className={ui.composer}>
    <label>版式<select aria-label="关注模块版式" value={follow} onChange={e => chooseFollow(e.target.value)}>{templates.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>名称或标题<input value={followFields[0]} onChange={e => setFollowField(0,e.target.value)} placeholder="例如：你的公众号名称" /></label>
    <label>一句介绍<input value={followFields[1]} onChange={e => setFollowField(1,e.target.value)} placeholder="你会分享什么内容" /></label>
    {media && <div className={ui.media}>
      <label>{media[0]}<input value={followFields[3].startsWith('data:') ? '' : followFields[3]} onChange={e => setFollowField(3,e.target.value)} placeholder={followFields[3].startsWith('data:') ? '已选择本地图片，可替换为图片链接' : '粘贴图片链接，或选择本地图片'} /></label>
      <div className={ui.mediaActions}><button type="button" className="btn" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? '读取中…' : followFields[3] ? '更换图片' : '选择图片'}</button>{followFields[3] && <button type="button" className="mini-action" disabled={uploading} onClick={() => setFollowField(3,'')}>移除图片</button>}</div>
      <input ref={fileInput} type="file" accept="image/*" aria-label="上传关注模块图片" hidden onChange={e => {
        const file = e.target.files?.[0]; e.target.value=''; if (!file) return;
        if (!file.type.startsWith('image/')) { p.onSay('请选择图片文件'); return; }
        const reader = new FileReader(); setUploading(true);
        reader.onload = () => { setFollowField(3,String(reader.result || '')); setUploading(false); };
        reader.onerror = () => { setUploading(false); p.onSay('图片读取失败，请重新选择'); };
        reader.readAsDataURL(file);
      }} />
      <small>本地图片在发布到公众号前需要上传为微信素材。</small>
    </div>}
    <details className={ui.options}><summary>引导文字与链接</summary>
      <label>引导文字<input value={followFields[2]} onChange={e => setFollowField(2,e.target.value)} /></label>
      <label>跳转链接（选填）<input type="url" value={followFields[4]} onChange={e => setFollowField(4,e.target.value)} placeholder="https://…" aria-invalid={invalidLink} /></label>
      <small>无链接时仅展示文字；关注公众号请使用二维码。原生名片需在微信后台插入。</small>
    </details>
    <div className={ui.preview}><span>效果预览 · 跟随文章风格</span><iframe title="关注模块效果预览" sandbox="" srcDoc={preview} /></div>
    {needsQr && <small>选择二维码图片后即可添加。</small>}
    {invalidLink && <small role="alert">请填写完整的 https:// 链接，或留空。</small>}
    <button type="button" className={`btn ${ui.add}`} disabled={uploading || needsQr || invalidLink} onClick={insertFollow}>{p.onPatchContent ? '添加到文末' : '插入关注模块'}</button>
  </div>;
}
