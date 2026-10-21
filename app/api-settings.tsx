'use client';

import { protectApiProfile } from '../lib/credential-client';
import { isSealedCredential } from '../lib/credential-format';
import { useEffect, useRef, useState } from 'react';
import { AI_PROVIDER_DEFAULTS, requestAi, type AiProviderId } from '../lib/providers';
import { defaultImageAdapter, type ApiProfile, type ApiProfileRoles } from '../lib/api-profiles';

export type ApiSettingsValue = { provider: '本地模拟' | AiProviderId; apiKey: string; model: string; endpoint: string };
type CatalogModel = { id: string; name: string; description: string; context: number; free: boolean };
const MAIN_PROVIDERS = ['OpenRouter', 'OpenAI', 'Anthropic'] as const;
const OTHER_PROVIDERS = ['Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Grok', 'Custom', '本地模拟'] as const;
const PROVIDER_DESCRIPTIONS = { OpenRouter: '聚合模型库', OpenAI: '官方模型接口', Anthropic: 'Claude 模型接口' } as const;
const MODEL_SOURCES: Partial<Record<AiProviderId, string>> = {
  OpenAI: 'https://developers.openai.com/api/docs/models',
  Anthropic: 'https://platform.claude.com/docs/en/models/overview',
  Gemini: 'https://ai.google.dev/gemini-api/docs/models',
  DeepSeek: 'https://api-docs.deepseek.com/quick_start/pricing/',
  Qwen: 'https://help.aliyun.com/zh/model-studio/models',
  Kimi: 'https://www.kimi.ai/help/kimi-api/api-model-selection',
  Grok: 'https://docs.x.ai/developers/models',
};
const KEY_HINTS: Partial<Record<AiProviderId, string>> = {
  OpenAI: '使用 OpenAI Platform 的 API Key；ChatGPT 订阅不等于 API 密钥。',
  Anthropic: '使用 Claude Console 的 API Key。',
  Gemini: '使用 Google AI Studio 的 Gemini API Key。',
  DeepSeek: '使用 DeepSeek 开放平台的 API Key。',
  Kimi: '使用 Kimi 开放平台的 API Key，区域须与密钥所属站点一致；会员和 Kimi Code 密钥不通用。',
  Grok: '使用 xAI Console 的 API Key；Grok 订阅不等于 API 密钥。',
};

function matchesProvider(id: string, provider: ApiSettingsValue['provider'], capability: 'text' | 'image') {
  const name = id.toLowerCase().split('/').pop() || id.toLowerCase();
  const family = provider === 'OpenAI' ? /^(gpt-|o[1-9]|chatgpt-|dall-e-)/ : provider === 'Anthropic' ? /^claude-/ : provider === 'Gemini' ? /^(gemini-|imagen-)/ : provider === 'DeepSeek' ? /^deepseek-/ : provider === 'Qwen' ? /^(qwen|qwq|wanx)/ : provider === 'Kimi' ? /^(kimi-|moonshot-)/ : provider === 'Grok' ? /^(grok-|aurora-)/ : null;
  if (family && !family.test(name)) return false;
  return capability === 'image' ? /image|imagen|dall-e|flux|seedream|recraft|ideogram|aurora|wanx/i.test(name) : !/image|imagen|dall-e|flux|seedream|recraft|ideogram|aurora|wanx|embedding|audio|speech|tts|video/i.test(name);
}

function RolePicker({ label, value, choices, onSelect }: { label: string; value: string; choices: { id: string; label: string }[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="api-role-picker"><span>{label}</span><button type="button" className="api-role-trigger" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{choices.find((item) => item.id === value)?.label || choices[0].label}</span><strong aria-hidden="true">▾</strong></button>{open && <div className="api-role-menu" role="group" aria-label={label}>{choices.map((item) => <button type="button" key={item.id} className={item.id === value ? 'active' : ''} aria-pressed={item.id === value} onClick={() => { onSelect(item.id); setOpen(false); }}>{item.label}{item.id === value && <b>✓</b>}</button>)}</div>}</div>;
}

export default function ApiSettings({ profiles, roles, onClose, onChange: commitChange }: { profiles: ApiProfile[]; roles: ApiProfileRoles; onClose: () => void; onChange: (profiles: ApiProfile[], roles: ApiProfileRoles) => void }) {
  const [value, setValue] = useState<ApiSettingsValue>({ provider: '本地模拟', apiKey: '', model: '', endpoint: '' });
  const [editingId, setEditingId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [textAdapter, setTextAdapter] = useState<ApiProfile['adapters']['text'] | ''>('');
  const [imageAdapter, setImageAdapter] = useState<ApiProfile['adapters']['image'] | ''>('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const onChange = (next: ApiProfile[], nextRoles: ApiProfileRoles) => { try { commitChange(next, nextRoles); return true; } catch (error) { setResult({ ok: false, text: error instanceof Error ? error.message : '配置保存失败' }); return false; } };
  const [search, setSearch] = useState('');
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [catalogState, setCatalogState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [catalogError, setCatalogError] = useState('');
  const [catalogTick, setCatalogTick] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imageModels, setImageModels] = useState<{ id: string; name: string }[]>([]);
  const [imageCatalogState, setImageCatalogState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [imageCatalogError, setImageCatalogError] = useState('');
  const [imageCatalogTick, setImageCatalogTick] = useState(0);
  const [imageSearch, setImageSearch] = useState('');
  const [connectionModels, setConnectionModels] = useState<{ id: string; name: string }[]>([]);
  const [connectionModelsError, setConnectionModelsError] = useState('');
  const [connectionTick, setConnectionTick] = useState(0);
  const [officialModels, setOfficialModels] = useState<{ id: string; name: string }[]>([]);
  const [officialState, setOfficialState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [officialError, setOfficialError] = useState('');
  const [officialTick, setOfficialTick] = useState(0);
  const set = (patch: Partial<ApiSettingsValue>) => { setValue((current) => ({ ...current, ...patch })); setResult(null); };
  const officialAddress = value.provider !== 'Custom' && value.provider !== '本地模拟' && (value.endpoint === AI_PROVIDER_DEFAULTS[value.provider].endpoint.replace(/\/chat\/completions$/, '') || value.provider === 'Kimi' && value.endpoint === 'https://api.moonshot.ai/v1');

  useEffect(() => {
    if (!pickerOpen || value.provider !== 'OpenRouter' || !officialAddress) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatalogState('loading');
      try {
        const response = await fetch('/api/ai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: search, apiKey: value.apiKey }), signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || '模型库读取失败');
        setModels(Array.isArray(payload.models) ? payload.models : []);
        setCatalogState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setModels([]);
        setCatalogError(error instanceof Error ? error.message : '模型库读取失败');
        setCatalogState('error');
      }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
    // 手动刷新会使用最新输入的密钥；输入密钥时不会反复请求模型库。
  }, [pickerOpen, value.provider, value.endpoint, search, catalogTick, officialAddress]);

  useEffect(() => {
    if ((!pickerOpen && !imagePickerOpen) || !value.apiKey.trim() || !value.endpoint.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/ai/connection-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: value.endpoint, apiKey: value.apiKey }), signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || '模型列表读取失败');
        setConnectionModels(Array.isArray(payload.models) ? payload.models : []);
        setConnectionModelsError('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setConnectionModels([]);
        setConnectionModelsError(error instanceof Error ? error.message : '模型列表读取失败');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [pickerOpen, imagePickerOpen, value.endpoint, value.apiKey, connectionTick]);

  useEffect(() => {
    if (!pickerOpen || !officialAddress || !['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Grok'].includes(value.provider)) return;
    if (!value.apiKey.trim() || value.provider === 'Qwen' && !workspaceId.trim()) { setOfficialModels([]); setOfficialState('idle'); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setOfficialState('loading');
      try {
        const response = await fetch('/api/ai/provider-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: value.provider, apiKey: value.apiKey, workspaceId, region: value.provider === 'Kimi' && value.endpoint === 'https://api.moonshot.ai/v1' ? 'international' : 'china' }), signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || '官方模型列表读取失败');
        setOfficialModels(Array.isArray(payload.models) ? payload.models : []);
        setOfficialState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setOfficialModels([]);
        setOfficialError(error instanceof Error ? error.message : '官方模型列表读取失败');
        setOfficialState('error');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [pickerOpen, value.provider, value.apiKey, value.endpoint, workspaceId, officialTick, officialAddress]);

  useEffect(() => {
    if (!imagePickerOpen || value.provider === '本地模拟') return;
    if (!value.apiKey.trim() || !officialAddress || !['OpenRouter', 'OpenAI', 'Gemini', 'Grok'].includes(value.provider)) { setImageModels([]); setImageCatalogState('idle'); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setImageCatalogState('loading');
      try {
        const response = await fetch('/api/ai/image-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: value.provider, baseUrl: value.endpoint, apiKey: value.apiKey }), signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || '生图模型列表读取失败');
        setImageModels(Array.isArray(payload.models) ? payload.models : []);
        setImageCatalogState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setImageModels([]);
        setImageCatalogError(error instanceof Error ? error.message : '生图模型列表读取失败');
        setImageCatalogState('error');
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [imagePickerOpen, value.provider, value.apiKey, value.endpoint, imageCatalogTick, officialAddress]);

  const chooseProvider = (provider: ApiSettingsValue['provider']) => {
    set({ provider, apiKey: provider === value.provider ? value.apiKey : '', model: '', endpoint: provider === 'Custom' ? value.endpoint : provider === '本地模拟' ? '' : AI_PROVIDER_DEFAULTS[provider].endpoint.replace(/\/chat\/completions$/, '') });
    setImageModel('');
    setTextAdapter('');
    setImageAdapter('');
    setImageModels([]);
    setConnectionModels([]);
    setOfficialModels([]);
    setModels([]);
    setImageSearch('');
    setWorkspaceId('');
    setSearch('');
    setPickerOpen(false);
    setImagePickerOpen(false);
  };
  const validate = () => {
    if (value.provider === '本地模拟') return '';
    if (!value.endpoint.trim()) return '请填写 API 地址';
    try { const url = new URL(value.endpoint); if (!['http:', 'https:'].includes(url.protocol)) return 'API 地址需使用 HTTP 或 HTTPS'; } catch { return 'API 地址格式不正确'; }
    if (!value.apiKey.trim()) return '请先填写 API Key';
    if (!value.model.trim() && !imageModel.trim()) return '请填写文本模型或配图模型';
    if (value.provider === 'Custom' && !value.endpoint.trim()) return '请填写 API 地址';
    return '';
  };
  const test = async () => {
    const error = validate();
    if (error) { setResult({ ok: false, text: error }); return; }
    if (value.provider === '本地模拟') { setResult({ ok: true, text: '本地模拟可用，生成方案时不会调用外部模型。' }); return; }
    setTesting(true);
    const checks = await Promise.all([
      fetch('/api/ai/connection-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: value.endpoint, apiKey: value.apiKey }) }).then(async (response) => { const payload = await response.json(); return { ok: response.ok && payload?.ok, text: response.ok && payload?.ok ? `服务连接：可读取 /models（${payload.models.length} 个模型）` : `服务连接：${payload?.error || '无法读取 /models'}` }; }).catch((error) => ({ ok: false, text: `服务连接：${error instanceof Error ? error.message : '请求失败'}` })),
      value.model.trim() ? requestAi({ provider: value.provider, apiKey: value.apiKey, model: value.model, endpoint: value.endpoint, adapter: textAdapter || 'openai-chat', prompt: '', action: 'test' }).then((response) => ({ ok: response.ok, text: response.ok ? `文本模型 ${response.model}：连接成功` : `文本模型：${response.error}` })) : Promise.resolve(null),
      imageModel.trim() ? fetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: value.provider, baseUrl: value.endpoint, apiKey: value.apiKey, model: imageModel, adapter: imageAdapter || defaultImageAdapter(value.provider, value.endpoint, imageModel), prompt: '一枚简洁的蓝色圆形图标', action: 'test' }) }).then(async (response) => { const payload = await response.json(); return { ok: response.ok && payload?.ok, text: response.ok && payload?.ok ? `配图模型 ${imageModel}：生成成功` : `配图模型：${payload?.error || '测试失败'}` }; }).catch((error) => ({ ok: false, text: `配图模型：${error instanceof Error ? error.message : '测试失败'}` })) : Promise.resolve(null),
    ]);
    const results = checks.filter((item): item is { ok: boolean; text: string } => item !== null);
    setResult({ ok: results.every((item) => item.ok), text: results.map((item) => item.text).join('；') });
    setTesting(false);
  };
  const save = async () => {
    if (savingRef.current) return;
    const error = validate(); if (error) { setResult({ ok: false, text: error }); return; }
    if (value.provider === '本地模拟') { if (onChange(profiles, { ...roles, textId: '' })) onClose(); return; }
    savingRef.current = true; setSaving(true);
    try {
    const baseUrl = value.endpoint.trim().replace(/\/chat\/completions\/?$/, '').replace(/\/$/, '');
    const matching = !editingId ? profiles.find((item) => item.provider === value.provider && item.baseUrl === baseUrl && item.apiKey === value.apiKey.trim()) : undefined;
    const id = editingId || matching?.id || crypto.randomUUID();
    const previous = profiles.find((item) => item.id === id);
    const selectedImageAdapter = imageAdapter || defaultImageAdapter(value.provider, baseUrl, imageModel);
    const modelConfigs = (previous?.modelConfigs || []).filter((entry) => entry.id !== `${id}:text` && entry.id !== `${id}:image`);
    if (value.model.trim()) modelConfigs.push({ id: `${id}:text`, modelId: value.model.trim(), displayName: value.model.trim(), capabilities: ['text'], adapter: textAdapter || 'openai-chat', enabled: true });
    if (imageModel.trim()) modelConfigs.push({ id: `${id}:image`, modelId: imageModel.trim(), displayName: imageModel.trim(), capabilities: ['image-generation'], adapter: selectedImageAdapter, enabled: true });
    const profile: ApiProfile = await protectApiProfile({ id, name: profileName.trim() || previous?.name || value.provider, provider: value.provider, baseUrl, apiKey: value.apiKey.trim(), models: { ...previous?.models, text: value.model.trim(), image: imageModel.trim() }, adapters: { text: textAdapter || 'openai-chat', image: selectedImageAdapter }, modelConfigs, workspaceId: value.provider === 'Qwen' ? workspaceId.trim() : undefined });
    const next = previous ? profiles.map((item) => item.id === id ? profile : item) : [...profiles, profile];
    const textId = roles.textId === id && !profile.models.text ? '' : roles.textId || (profile.models.text ? id : '');
    const imageId = roles.imageId === id && !profile.models.image ? '' : roles.imageId || (profile.models.image ? id : '');
    if (onChange(next, { textId, imageId, textModelId: next.find((item) => item.id === textId)?.modelConfigs.find((item) => item.capabilities.includes('text'))?.id, imageModelId: next.find((item) => item.id === imageId)?.modelConfigs.find((item) => item.capabilities.includes('image-generation'))?.id })) onClose();
    } catch (error) { setResult({ ok: false, text: error instanceof Error ? error.message : '安全保存失败' }); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const reset = () => { setValue({ provider: '本地模拟', apiKey: '', model: '', endpoint: '' }); setEditingId(''); setProfileName(''); setImageModel(''); setTextAdapter(''); setImageAdapter(''); setImageModels([]); setImagePickerOpen(false); setWorkspaceId(''); setModels([]); setResult(null); };
  const defaultEndpoint = value.provider === '本地模拟' || value.provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[value.provider].endpoint.replace(/\/chat\/completions$/, '');
  const endpoint = value.endpoint;
  const isOfficialEndpoint = value.provider !== 'Custom' && (endpoint === defaultEndpoint || value.provider === 'Kimi' && endpoint === 'https://api.moonshot.ai/v1');
  const textChoices = Array.from(new Map([...connectionModels, ...(officialAddress ? officialModels : []), ...(value.provider === 'OpenRouter' && officialAddress ? models.map((item) => ({ id: item.id, name: item.name })) : [])].map((item) => [item.id, item])).values()).filter((item) => matchesProvider(item.id, value.provider, 'text') && `${item.id} ${item.name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 80);
  const imageChoices = Array.from(new Map([...connectionModels, ...(officialAddress ? imageModels : [])].map((item) => [item.id, item])).values()).filter((item) => matchesProvider(item.id, value.provider, 'image') && `${item.id} ${item.name}`.toLowerCase().includes(imageSearch.toLowerCase())).slice(0, 80);

  return <div className="v091-modal-backdrop api-settings-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingRef.current) onClose(); }}>
    <section className="v091-local-api-modal api-settings-modal" role="dialog" aria-modal="true" aria-labelledby="apiSettingsTitle">
      <header className="api-settings-header">
        <span className="api-settings-kicker">KAIPAI / AI SERVICE</span>
        <h2 id="apiSettingsTitle">AI 服务配置</h2>
        <p>选择服务、确认模型，再测试连接。</p>
        <button type="button" className="api-settings-close" onClick={() => { if (!savingRef.current) onClose(); }} aria-label="关闭 API 设置">×</button>
      </header>
      <fieldset className="api-settings-scroll" disabled={saving} style={{ border: 0, margin: 0, minWidth: 0 }}>
        <section className="api-profile-manager" aria-label="已保存的 AI 服务">
          <div className="api-field-head"><h3>已保存的 AI 服务</h3><span>{profiles.length} 个配置 · 加密凭证保存在此浏览器</span></div>
          {profiles.length ? <div className="api-profile-list">{profiles.map((profile) => <div className="api-profile-item" key={profile.id}><div><b>{profile.name}</b><small>{profile.provider} · 文本 {profile.models.text || '未配置'} · 配图 {profile.models.image || '未配置'}</small></div><button type="button" onClick={() => { setEditingId(profile.id); setProfileName(profile.name); setImageModel(profile.models.image); setTextAdapter(profile.adapters.text === 'openai-chat' ? '' : profile.adapters.text); setImageAdapter(profile.adapters.image === defaultImageAdapter(profile.provider, profile.baseUrl, profile.models.image) ? '' : profile.adapters.image); setWorkspaceId(profile.workspaceId || ''); setConnectionModels([]); setOfficialModels([]); setModels([]); setImageModels([]); setValue({ provider: profile.provider, apiKey: profile.apiKey, model: profile.models.text, endpoint: profile.baseUrl }); }}>编辑</button><button type="button" onClick={() => { const next = profiles.filter((item) => item.id !== profile.id); const textId = roles.textId === profile.id ? next.find((item) => item.models.text)?.id || '' : roles.textId; const imageId = roles.imageId === profile.id ? next.find((item) => item.models.image)?.id || '' : roles.imageId; onChange(next, { textId, imageId, textModelId: next.find((item) => item.id === textId)?.modelConfigs.find((item) => item.capabilities.includes('text'))?.id, imageModelId: next.find((item) => item.id === imageId)?.modelConfigs.find((item) => item.capabilities.includes('image-generation'))?.id }); }}>删除</button></div>)}</div> : <p className="api-model-empty">还没有保存的服务。下方表单可新建配置。</p>}
          <div className="api-role-grid"><RolePicker label="文章修改与排版" value={roles.textId} choices={[{ id: '', label: '本地模拟' }, ...profiles.filter((profile) => profile.models.text).map((profile) => ({ id: profile.id, label: `${profile.name} · ${profile.models.text}` }))]} onSelect={(textId) => onChange(profiles, { ...roles, textId, textModelId: profiles.find((item) => item.id === textId)?.modelConfigs.find((item) => item.capabilities.includes('text'))?.id })} /><RolePicker label="图片生成" value={roles.imageId} choices={[{ id: '', label: '未选择' }, ...profiles.filter((profile) => profile.models.image).map((profile) => ({ id: profile.id, label: `${profile.name} · ${profile.models.image}` }))]} onSelect={(imageId) => onChange(profiles, { ...roles, imageId, imageModelId: profiles.find((item) => item.id === imageId)?.modelConfigs.find((item) => item.capabilities.includes('image-generation'))?.id })} /></div>
        </section>
        <div className="api-field-head"><h3>{editingId ? '编辑服务' : '添加 AI 服务'}</h3>{editingId && <button type="button" className="api-endpoint-reset" onClick={reset}>添加新服务</button>}</div>
        <div className="api-step-heading"><span>01</span><div><h3>选择服务并填写凭证</h3><p>API 地址和 Key 只填一次，供下方两个模型共用。</p></div></div>
        <div className="api-provider-grid" role="group" aria-label="主要模型服务">
          {MAIN_PROVIDERS.map((provider) => <button key={provider} type="button" className={value.provider === provider ? 'active' : ''} aria-pressed={value.provider === provider} onClick={() => chooseProvider(provider)}><b>{provider}</b><small>{PROVIDER_DESCRIPTIONS[provider]}</small></button>)}
        </div>
        <div className="api-other-providers" role="group" aria-label="更多模型服务"><span>其他服务</span>{OTHER_PROVIDERS.map((provider) => <button key={provider} type="button" aria-pressed={value.provider === provider} className={value.provider === provider ? 'active' : ''} onClick={() => chooseProvider(provider)}>{provider === 'Custom' ? '自定义接口' : provider}</button>)}</div>

        {value.provider === '本地模拟' ? <div className="api-local-card"><b>本地模拟已就绪</b><p>无需密钥，可体验“生成方案 → 查看建议 → 应用风格”的流程。</p></div> : <>
          <div className="api-credential-fields">
          <div className="api-form-field"><div className="api-field-head"><label htmlFor="apiProfileName">服务名称</label></div><input id="apiProfileName" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="例如：我的 AI 服务" maxLength={36} /></div>
          <div className="api-form-field"><div className="api-field-head"><label htmlFor="apiEndpoint">API 地址</label>{value.provider !== 'Custom' && <button type="button" className="api-endpoint-reset" onClick={() => set({ endpoint: defaultEndpoint })}>恢复默认</button>}</div><input id="apiEndpoint" value={endpoint} onChange={(event) => set({ endpoint: event.target.value })} placeholder="https://example.com/v1 或 http://example.com/v1" autoComplete="off" />{value.provider === 'Kimi' && <div className="api-region-choice" role="group" aria-label="Kimi API 区域"><button type="button" className={endpoint === 'https://api.moonshot.cn/v1' ? 'active' : ''} aria-pressed={endpoint === 'https://api.moonshot.cn/v1'} onClick={() => set({ endpoint: 'https://api.moonshot.cn/v1' })}>中国站</button><button type="button" className={endpoint === 'https://api.moonshot.ai/v1' ? 'active' : ''} aria-pressed={endpoint === 'https://api.moonshot.ai/v1'} onClick={() => set({ endpoint: 'https://api.moonshot.ai/v1' })}>国际站</button></div>}</div>
          <div className="api-form-field"><div className="api-field-head"><label htmlFor="apiKey">API Key</label>{value.provider === 'OpenRouter' && isOfficialEndpoint && <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer">获取 OpenRouter API Key ↗</a>}</div><div className="api-key-field"><input id="apiKey" value={isSealedCredential(value.apiKey) ? '' : value.apiKey} onChange={(event) => set({ apiKey: event.target.value })} type={keyVisible ? 'text' : 'password'} placeholder={isSealedCredential(value.apiKey) ? '已安全保存，输入新 Key 可替换' : '粘贴当前地址对应的 API Key'} autoComplete="off" /><button type="button" disabled={isSealedCredential(value.apiKey)} onClick={() => setKeyVisible((current) => !current)}>{keyVisible ? '隐藏' : '显示'}</button></div>{isOfficialEndpoint && KEY_HINTS[value.provider as AiProviderId] && <p className="api-key-hint">{KEY_HINTS[value.provider as AiProviderId]}</p>}</div>
          {value.provider === 'Qwen' && <div className="api-form-field"><div className="api-field-head"><label htmlFor="apiWorkspaceId">百炼业务空间 ID</label><span>用于读取官方模型目录</span></div><input id="apiWorkspaceId" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} placeholder="填写业务空间 ID" autoComplete="off" /></div>}
          </div>
          <div className="api-step-heading"><span>02</span><div><h3>为任务选择模型</h3><p>可以直接填写模型 ID，也可以从列表选择。</p></div></div>
          <section className="api-capability-card" aria-label="文本生成模型"><div className="api-field-head"><label htmlFor="apiModel">文本模型</label><span>文章修改与排版</span></div><div className="api-model-entry"><input id="apiModel" value={value.model} onChange={(event) => set({ model: event.target.value })} placeholder="输入文本模型 ID" autoComplete="off" /><button type="button" aria-expanded={pickerOpen} onClick={() => { setPickerOpen((open) => !open); setImagePickerOpen(false); }}>{pickerOpen ? '收起列表' : '从列表选择'}</button></div>
          <details className="api-advanced-protocol"><summary>高级设置 · 文本接口</summary><p>通常保持自动。只有服务说明要求使用 Responses 接口时才改。</p><div className="api-protocol-options" role="group" aria-label="文本接口">{([{ id: '', title: '自动选择', detail: '默认使用大多数服务兼容的聊天接口' }, { id: 'openai-chat', title: '聊天接口', detail: '适合 OpenAI 兼容文本模型' }, { id: 'openai-responses', title: 'Responses 接口', detail: '仅在模型或代理明确要求时使用' }] as const).map((option) => <button key={option.id} type="button" className={textAdapter === option.id ? 'active' : ''} aria-pressed={textAdapter === option.id} onClick={() => setTextAdapter(option.id)}><b>{option.title}</b><small>{option.detail}</small></button>)}</div></details>
          {pickerOpen && <div className="api-model-section api-picker-panel">
            <div className="api-picker-header"><b>{value.provider === 'Custom' ? '当前连接' : value.provider} · 文本模型</b><button type="button" onClick={() => { setConnectionTick((tick) => tick + 1); setOfficialTick((tick) => tick + 1); setCatalogTick((tick) => tick + 1); }}>刷新列表</button></div>
            <input className="api-picker-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索模型名称或 ID" aria-label="搜索文本模型" autoComplete="off" />
            {!value.apiKey.trim() ? <p className="api-model-empty">填写 API Key 后读取模型。</p> : textChoices.length ? <div className="api-model-list" role="group" aria-label="文本模型选项">{textChoices.map((item) => <button key={item.id} type="button" className={value.model === item.id ? 'active' : ''} onClick={() => { set({ model: item.id }); setPickerOpen(false); }}><span className="api-model-main"><b>{item.name}</b><small>{item.id}</small></span>{value.model === item.id && <strong>✓</strong>}</button>)}</div> : <p className="api-model-empty">{connectionModelsError || officialError || catalogError || '没有匹配的文本模型；也可以直接填写模型 ID。'}</p>}
            <p className="api-sync-help">仅显示当前服务商的文本模型。模型目录不保证当前账号有调用权限。</p>
          </div>}
          </section>
          <section className="api-capability-card" aria-label="配图生成模型"><div className="api-field-head"><label htmlFor="apiImageModel">配图模型</label><span>可留空</span></div><div className="api-model-entry"><input id="apiImageModel" value={imageModel} onChange={(event) => { setImageModel(event.target.value); setResult(null); }} placeholder="输入生图模型 ID" autoComplete="off" /><button type="button" aria-expanded={imagePickerOpen} onClick={() => { setImagePickerOpen((open) => !open); setPickerOpen(false); }}>{imagePickerOpen ? '收起列表' : '从列表选择'}</button></div>
          <details className="api-advanced-protocol"><summary>高级设置 · 配图接口</summary><p>通常保持自动；系统会按服务地址和模型 ID 选择调用方式。</p><div className="api-protocol-options" role="group" aria-label="配图接口">{([{ id: '', title: '自动选择', detail: '本地 Gemini Image 走聊天接口；OpenAI 图片走图片接口' }, { id: 'antigravity-gemini-image-chat', title: '聊天接口生图', detail: 'CLIProxyAPI / Antigravity 的 Gemini Image' }, { id: 'openai-images', title: '图片接口生图', detail: '支持 /images/generations 的服务' }, { id: 'gemini-native', title: 'Gemini 官方接口', detail: '仅适用于 Google 官方 API 地址和 Key' }] as const).map((option) => <button key={option.id} type="button" className={imageAdapter === option.id ? 'active' : ''} aria-pressed={imageAdapter === option.id} onClick={() => setImageAdapter(option.id)}><b>{option.title}</b><small>{option.detail}</small></button>)}</div></details>
          {imagePickerOpen && <div className="api-model-section api-picker-panel">
            <div className="api-picker-header"><b>{value.provider === 'Custom' ? '当前连接' : value.provider} · 配图模型</b><button type="button" onClick={() => { setConnectionTick((tick) => tick + 1); setImageCatalogTick((tick) => tick + 1); }}>刷新列表</button></div>
            <input className="api-picker-search" value={imageSearch} onChange={(event) => setImageSearch(event.target.value)} placeholder="搜索生图模型名称或 ID" aria-label="搜索配图模型" autoComplete="off" />
            {!value.apiKey.trim() ? <p className="api-model-empty">填写 API Key 后读取模型。</p> : imageChoices.length ? <div className="api-model-list" role="group" aria-label="配图模型选项">{imageChoices.map((item) => <button key={item.id} type="button" className={imageModel === item.id ? 'active' : ''} onClick={() => { setImageModel(item.id); setImageAdapter(''); setImagePickerOpen(false); setResult(null); }}><span className="api-model-main"><b>{item.name}</b><small>{item.id}</small></span>{imageModel === item.id && <strong>✓</strong>}</button>)}</div> : <p className="api-model-empty">{connectionModelsError || imageCatalogError || '没有匹配的配图模型；也可以直接填写模型 ID。'}</p>}
            <p className="api-sync-help">仅显示名字可识别的配图模型。是否支持生图，以模型测试结果为准。</p>
          </div>}
          </section>

        </>}
        <p className="api-settings-note">保存后，此浏览器只保留加密凭证，关闭后再打开可继续使用；清除网站数据后需重新填写。调用时密钥由本站后端解密并转发给所选服务。测试会分别请求已填写的文本模型和配图模型；配图测试会实际生成一张小图，可能产生费用。</p>
        {result && <div className={`api-test-result ${result.ok ? 'success' : 'error'}`} role="status">{result.text}</div>}
      </fieldset>
      <footer className="api-settings-actions"><button type="button" className="api-save" onClick={save} disabled={saving || testing}>{saving ? '安全保存中…' : '保存配置'}</button><button type="button" className="api-test" onClick={test} disabled={testing || saving}>{testing ? '测试中…' : '测试连接'}</button><button type="button" className="api-reset" onClick={reset} disabled={saving}>清空</button><button type="button" className="api-cancel" onClick={() => { if (!savingRef.current) onClose(); }}>取消</button></footer>
    </section>
  </div>;
}
