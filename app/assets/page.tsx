'use client';

import { useEffect, useState } from 'react';
import { listAssets, saveAssets, type LocalAsset } from '../../lib/assets';
import { newId } from '../../lib/id';
import './assets.css';

export default function AssetsPage() {
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<LocalAsset['tags']>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAssets(listAssets());
    } catch {}
  }, []);

  const persist = (next: LocalAsset[]) => {
    try {
      saveAssets(next);
      setAssets(next);
      return true;
    } catch {
      window.alert('素材库保存失败，可能是浏览器存储空间不足或已被禁用');
      return false;
    }
  };

  const addAsset = () => {
    const cleanUrl = url.trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      window.alert('请输入以 http:// 或 https:// 开头的图片地址');
      return;
    }
    const id = newId();
    const next = [{ id, name: name.trim() || '未命名图片', url: cleanUrl, note: note.trim(), tags, createdAt: Date.now() }, ...assets];
    if (!persist(next)) return;
    setName(''); setUrl(''); setNote(''); setTags([]);
  };

  const copyMarkdown = async (asset: LocalAsset) => {
    const markdown = `![${asset.name}](${asset.url})`;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(asset.id);
      window.setTimeout(() => setCopied(current => current === asset.id ? null : current), 1600);
    } catch {
      window.alert('复制失败，请手动复制图片地址');
    }
  };

  return (
    <main className="assets-page">
      <header className="assets-header"><div className="assets-header-inner"><a href="/" className="assets-back">← 返回编辑器</a><span className="assets-header-mark">楷排 / 素材库</span></div></header>
      <div className="assets-content">
        <div className="assets-heading"><span className="assets-kicker">LOCAL IMAGE LIBRARY</span><h1>本地图片资产</h1><p>图片地址、标签和备注只保存在当前浏览器，不会自动上传。标签可供“我的风格”和编辑器直接引用。</p></div>
        <section className="assets-form">
          <input aria-label="图片名称" placeholder="图片名称" value={name} onChange={e => setName(e.target.value)} />
          <input aria-label="图片地址" placeholder="https://… 图片地址" value={url} onChange={e => setUrl(e.target.value)} />
          <input aria-label="图片备注" placeholder="备注（可选）" value={note} onChange={e => setNote(e.target.value)} />
          <div className="assets-tags">{([{ id: 'avatar', name: '头像' }, { id: 'qrcode', name: '二维码' }, { id: 'cover', name: '封面' }, { id: 'body', name: '正文配图' }] as const).map(tag => <label key={tag.id}><input type="checkbox" checked={tags.includes(tag.id)} onChange={() => setTags(current => current.includes(tag.id) ? current.filter(item => item !== tag.id) : [...current, tag.id])} /> {tag.name}</label>)}</div>
          <button type="button" className="assets-add" onClick={addAsset}>＋ 加入素材库</button>
        </section>
        <section className="assets-grid">
          {assets.map(asset => <article className="assets-card" key={asset.id}>
            <img src={asset.url} alt={asset.name} onError={e => { e.currentTarget.style.opacity = '0.35'; }} />
            <div className="assets-card-body"><strong>{asset.name}</strong>{asset.tags.length > 0 && <p className="assets-card-tags">{asset.tags.map(tag => ({ avatar: '头像', qrcode: '二维码', cover: '封面', body: '正文配图' }[tag])).join(' · ')}</p>}{asset.note && <p>{asset.note}</p>}<div className="assets-card-actions"><button type="button" onClick={() => copyMarkdown(asset)}>{copied === asset.id ? '已复制' : '复制 Markdown'}</button><button type="button" className="assets-remove" onClick={() => persist(assets.filter(item => item.id !== asset.id))}>移除</button></div></div>
          </article>)}
        </section>
      </div>
    </main>
  );
}
