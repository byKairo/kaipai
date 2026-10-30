'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DiscoveryModel } from '../lib/model-discovery';
export function ModelPicker({ id, label, value, models, source, kind, onChange }: { id: string; label: string; value: string; models: DiscoveryModel[]; source?: string; kind: 'text' | 'image'; onChange: (value: string) => void }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{left: number; top: number; width: number; maxHeight: number}>();
  const panel = useRef<HTMLDivElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [active, setActive] = useState(-1);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const dialog = anchor.current?.closest('[role="dialog"]');
      const upper = Math.max(16, (dialog?.querySelector('header')?.getBoundingClientRect().bottom ?? 8) + 8);
      const lower = Math.min(window.innerHeight - 16, (dialog?.querySelector('footer')?.getBoundingClientRect().top ?? window.innerHeight) - 8);
      const below = lower - rect.bottom - 6;
      const above = rect.top - upper - 6;
      const height = Math.min(440, Math.max(above, below));
      const top = below >= above ? rect.bottom + 6 : Math.max(upper, rect.top - height - 6);
      setPosition({ left: Math.max(16, Math.min(rect.left, window.innerWidth - Math.min(520, window.innerWidth - 32) - 16)), top, width: Math.min(520, window.innerWidth - 32), maxHeight: Math.max(180, Math.min(height, lower - top)) });
    };
    place();
    window.addEventListener('resize', place);
    const scroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) place(); };
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', scroll, true); };
  }, [open]);
  useEffect(() => { if (open && active >= 0) activeOption.current?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  const choices = models.filter(model => (all || model.kinds.includes(kind) || model.classification === 'unknown') && `${model.id} ${model.name}`.toLowerCase().includes(query.toLowerCase()));
  const select = (model: string) => { onChange(model); setQuery(''); setOpen(false); setActive(-1); };
  return <div className="api-form-field api-model-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <div className="api-combobox" ref={anchor}><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} value={value} onFocus={() => { setOpen(true); setQuery(''); setActive(-1); }} onChange={event => { onChange(event.target.value); setQuery(event.target.value); setActive(-1); setOpen(true); }} onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(current => Math.max(0, Math.min(choices.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))); }
      if (event.key === 'Enter') { event.preventDefault(); if (open && choices[active]) select(choices[active].id); else setOpen(false); }
    }} placeholder={kind === 'image' ? '不使用封面生成' : '选择或输入模型名称'} autoComplete="off" /><button type="button" aria-label={`展开${label}列表`} aria-expanded={open} onClick={() => { setOpen(!open); setQuery(''); setActive(-1); }}>▾</button></div>
    {open && <div className="api-picker-panel" ref={panel} style={position} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); event.stopPropagation(); anchor.current?.querySelector('input')?.focus(); setOpen(false); } }}>
      <div className="api-picker-heading"><strong>{label}</strong><button type="button" onClick={() => setOpen(false)} aria-label="收起模型列表">×</button></div>
      <p className="api-picker-source">{source} · {choices.length} 个匹配项</p>
      <input className="api-picker-search" aria-label={`搜索${label}`} placeholder="搜索模型名称，不会改变已选模型" value={query} onChange={event => { setQuery(event.target.value); setActive(-1); }} />
      {query.trim() && !models.some(model => model.id === query.trim()) && <button className="api-picker-none" type="button" onClick={() => select(query.trim())}>使用自定义模型：{query.trim()}</button>}
      {kind === 'image' && <button className="api-picker-none" type="button" onClick={() => select('')}>不使用封面生成</button>}
      <div id={`${id}-options`} className="api-model-list" role="listbox" aria-label={`${label}选项`}>{choices.map((model, index) => <button id={`${id}-option-${index}`} ref={index === active ? activeOption : undefined} type="button" role="option" aria-selected={model.id === value} key={model.id} className={index === active || model.id === value ? 'active' : ''} onClick={() => select(model.id)}><span className="api-model-main"><b>{model.name}</b>{model.name !== model.id && <small>{model.id}</small>}{model.classification === 'unknown' && <small>能力待测试</small>}</span>{model.id === value && <strong>✓</strong>}</button>)}</div>
      {!choices.length && <p className="api-model-empty">没有匹配项，可直接输入准确的模型名。</p>}
      {models.some(model => !model.kinds.includes(kind) && model.classification !== 'unknown') && <button className="api-picker-more" type="button" onClick={() => setAll(current => !current)}>{all ? '只看相关模型' : '找不到？查看全部模型'}</button>}
    </div>}
  </div>;
}
