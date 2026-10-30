'use client';
import './api-settings.css';

import { useEffect, useRef, useState } from 'react';
import { ModelPicker } from './model-picker';
import type { DiscoveryModel } from '../lib/model-discovery';
import { REFERENCE_SOURCES, type ReferenceProvider } from '../lib/reference-models';
import { aiFetch, isLocalApi } from '../lib/ai-transport';
import { protectApiProfile } from '../lib/credential-client';
import { isSealedCredential } from '../lib/credential-format';
import { requestAi, type AiProviderId } from '../lib/providers';
import { connectionRoles, savedConnectionRoles, saveConnection } from '../lib/api-connection-state';
import { defaultImageAdapter, type ApiProfile, type ApiProfileRoles } from '../lib/api-profiles';
import { identifyApiAddress } from '../lib/api-setup';

export type ApiSettingsValue = { provider: '本地模拟' | AiProviderId; apiKey: string; model: string; endpoint: string };

export default function ApiSettings({ profiles, roles, onClose, onChange }: { profiles: ApiProfile[]; roles: ApiProfileRoles; onClose: () => void; onChange: (profiles: ApiProfile[], roles: ApiProfileRoles) => void }) {
  const initial = profiles.find(profile => profile.id === roles.textId) || profiles.find(profile => profile.id === roles.imageId) || profiles[0];
  const [profileName, setProfileName] = useState(initial?.name || '');
  const [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false);
  const testingRef = useRef(false);
  const drafts = useRef(new Map<string, { endpoint: string; apiKey: string; textModel: string; imageModel: string; profileName: string; textAdapter: ApiProfile['adapters']['text'] }>());
  const [editingId, setEditingId] = useState(initial?.id || '');
  const [endpoint, setEndpoint] = useState(initial?.baseUrl || '');
  const [apiKey, setApiKey] = useState(initial?.apiKey || '');
  const [textModel, setTextModel] = useState(initial?.models.text || '');
  const [imageModel, setImageModel] = useState(initial?.models.image || '');
  const [textAdapter, setTextAdapter] = useState<ApiProfile['adapters']['text']>(initial?.adapters.text || 'openai-chat');
  const [keyVisible, setKeyVisible] = useState(false);
  const [stage, setStage] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [models, setModels] = useState<DiscoveryModel[]>([]);
  const [directoryNote, setDirectoryNote] = useState('');
  const [error, setError] = useState('');
  const [referenceProvider, setReferenceProvider] = useState<ReferenceProvider>('OpenAI');
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [referenceNote, setReferenceNote] = useState('');
  const [useAfterSave, setUseAfterSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const job = useRef<AbortController | null>(null);
  const referenceJob = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; job.current?.abort(); referenceJob.current?.abort(); }; }, []);
  const previous = profiles.find(profile => profile.id === editingId);
  const busy = saving || testing || stage === 'loading';
  const showModels = stage === 'ready' || stage === 'fallback' || Boolean(textModel || imageModel);

  const clearDirectory = () => {
    job.current?.abort(); referenceJob.current?.abort();
    setStage('idle'); setModels([]); setDirectoryNote(''); setError(''); setNotice(''); setReferenceNote(''); setReferenceBusy(false);
  };
  const loadProfile = (id: string, preserveDraft = true) => {
    if (preserveDraft) drafts.current.set(editingId, { endpoint, apiKey, textModel, imageModel, profileName, textAdapter });
    const profile = profiles.find(item => item.id === id);
    const draft = drafts.current.get(id);
    clearDirectory(); setUseAfterSave(false); setEditingId(id); setEndpoint(draft?.endpoint ?? profile?.baseUrl ?? ''); setApiKey(draft?.apiKey ?? profile?.apiKey ?? '');
    setTextModel(draft?.textModel ?? profile?.models.text ?? ''); setImageModel(draft?.imageModel ?? profile?.models.image ?? ''); setKeyVisible(false);
    setProfileName(draft?.profileName ?? profile?.name ?? '');
    setTextAdapter(draft?.textAdapter ?? profile?.adapters.text ?? 'openai-chat');
  };
  const activate = (profile: ApiProfile) => {
    try { onChange(profiles, connectionRoles(profile)); setNotice(`已切换到「${profile.name}」的已保存模型。`); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '切换失败'); }
  };
  const removeConnection = () => {
    try {
      onChange(profiles.filter(profile => profile.id !== editingId), { ...roles, ...(roles.textId === editingId ? { textId: '', textModelId: undefined } : {}), ...(roles.imageId === editingId ? { imageId: '', imageModelId: undefined } : {}) });
      drafts.current.delete(editingId); drafts.current.delete(''); loadProfile('', false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '未能移除连接'); }
  };
  const loadReferences = async (provider: ReferenceProvider) => {
    referenceJob.current?.abort();
    const controller = new AbortController(); referenceJob.current = controller;
    setReferenceProvider(provider); setReferenceBusy(true); setModels([]); setReferenceNote('正在更新参考模型…');
    try {
      const response = await fetch('/api/ai/reference-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }), signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || '参考模型更新失败，可直接填写模型名。');
      if (controller.signal.aborted || !alive.current) return;
      setModels(payload.models || []);
      setReferenceNote(payload.status === 'live' ? `${payload.partial ? '部分目录已更新' : '已更新'} · ${new Date(payload.fetchedAt).toLocaleDateString()} · 是否可用以当前服务为准` : `更新失败，使用 ${payload.fetchedAt} 参考快照`);
    } catch (failure) { if (!controller.signal.aborted && alive.current) setReferenceNote(failure instanceof Error ? failure.message : '参考模型更新失败，可直接填写模型名。'); }
    finally { if (!controller.signal.aborted && alive.current) setReferenceBusy(false); }
  };
  const discover = async () => {
    let connection: ReturnType<typeof identifyApiAddress>;
    try {
      connection = identifyApiAddress(endpoint);
      if (!apiKey.trim()) throw new Error('请填写这个地址对应的 API Key');
    } catch (failure) { setError(failure instanceof TypeError ? '请填写完整的 API 地址' : failure instanceof Error ? failure.message : '请检查 API 地址'); return; }
    job.current?.abort(); referenceJob.current?.abort();
    const controller = new AbortController(); job.current = controller;
    setStage('loading'); setNotice(''); setError(''); setDirectoryNote(''); setModels([]); setReferenceBusy(false); setEndpoint(connection.baseUrl);
    try {
      const response = await aiFetch('/api/ai/connection-models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ baseUrl: connection.baseUrl, apiKey: apiKey.trim() }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || '暂时无法读取模型列表');
      if (!alive.current || controller.signal.aborted) return;
      const list = Array.isArray(payload.models) ? payload.models : [];
      if (!list.length) throw new Error('这个服务没有返回模型列表');
      setModels(list); setStage('ready'); setDirectoryNote(`接口已返回 ${list.length} 个模型 · 选择后测试是否可用。`);
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
      setStage('fallback');
      setError(failure instanceof Error ? failure.message : '暂时无法读取模型列表');
      const provider = Object.hasOwn(REFERENCE_SOURCES, connection.provider) ? connection.provider as ReferenceProvider : 'OpenAI';
      void loadReferences(provider);
    }
  };
  const connectionInput = () => {
    const connection = identifyApiAddress(endpoint);
    if (!apiKey.trim()) throw new Error('请填写 API Key');
    if (!textModel.trim() && !imageModel.trim()) throw new Error('请选择文章模型或封面模型');
    if (isSealedCredential(apiKey) && previous?.baseUrl !== connection.baseUrl) throw new Error('地址已更换，请填写新地址的 API Key');
    const provider = isSealedCredential(apiKey) && previous ? previous.provider : connection.provider;
    const imageAdapter = previous?.baseUrl === connection.baseUrl && previous.models.image === imageModel.trim() ? previous.adapters.image : defaultImageAdapter(provider, connection.baseUrl, imageModel.trim());
    return { ...connection, provider, imageAdapter, key: apiKey.trim() };
  };
  const testConnection = async (saveAfter = false) => {
    if (testingRef.current) { job.current?.abort(); return; }
    setError(''); setNotice('');
    let connection: ReturnType<typeof connectionInput>;
    try { connection = connectionInput(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '请检查连接信息'); return; }
    const controller = new AbortController(); job.current?.abort(); job.current = controller;
    testingRef.current = true; setTesting(true);
    const passed: string[] = [];
    try {
      if (textModel.trim()) {
        setNotice('正在测试文章模型…');
        const response = await requestAi({ provider: connection.provider, apiKey: connection.key, endpoint: connection.baseUrl, model: textModel.trim(), adapter: textAdapter, prompt: '', action: 'test' }, controller.signal);
        if (!response.ok) throw new Error(`文章测试失败：${response.error}`);
        passed.push('文章');
      }
      if (imageModel.trim()) {
        setNotice(`${passed.length ? '文章已通过。' : ''}正在测试封面模型…`);
        const response = await aiFetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ provider: connection.provider, baseUrl: connection.baseUrl, apiKey: connection.key, model: imageModel.trim(), adapter: connection.imageAdapter, prompt: '纯白背景中一枚蓝色圆形，不含文字', action: 'test' }) });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(`封面测试失败：${payload.error || '连接验证失败'}`);
        passed.push('封面');
      }
      if (alive.current && !controller.signal.aborted) {
        if (saveAfter) await save(true);
        else setNotice(`${passed.join('、')}模型测试通过，尚未保存。`);
      }
    } catch (failure) {
      if (alive.current) { setNotice(controller.signal.aborted ? '测试已取消。' : ''); if (!controller.signal.aborted) setError(`${passed.length ? passed.join('、') + '已通过；' : ''}${(failure instanceof Error ? failure.message : '测试失败').replace(/[。.,，]+$/, '')}。配置未改动。`); }
    } finally { testingRef.current = false; if (alive.current) setTesting(false); }
  };
  const save = async (tested = false) => {
    if (savingRef.current) return;
    setError('');
    try {
      const connection = connectionInput();
      savingRef.current = true; setSaving(true);
      const id = editingId || crypto.randomUUID();
      const provider = connection.provider;
      const sameConnection = previous?.baseUrl === connection.baseUrl;
      const imageAdapter = connection.imageAdapter;
      const modelConfigs = (previous?.modelConfigs || []).filter(model => model.id !== `${id}:text` && model.id !== `${id}:image`);
      if (textModel.trim()) modelConfigs.push({ id: `${id}:text`, modelId: textModel.trim(), displayName: textModel.trim(), capabilities: ['text'], adapter: textAdapter, enabled: true });
      if (imageModel.trim()) modelConfigs.push({ id: `${id}:image`, modelId: imageModel.trim(), displayName: imageModel.trim(), capabilities: ['image-generation'], adapter: imageAdapter, enabled: true });
      const profile = await protectApiProfile({ id, name: profileName.trim() || new URL(connection.baseUrl).host, provider, baseUrl: connection.baseUrl, apiKey: apiKey.trim(), models: { ...previous?.models, text: textModel.trim(), image: imageModel.trim() }, adapters: { text: textAdapter, image: imageAdapter }, modelConfigs, workspaceId: sameConnection ? previous.workspaceId : undefined });
      if (!alive.current) return;
      onChange(saveConnection(profiles, profile), savedConnectionRoles(roles, profile, useAfterSave));
      drafts.current.delete(editingId); setEditingId(id); setProfileName(profile.name); setApiKey(profile.apiKey); setEndpoint(profile.baseUrl);
      setNotice(`${tested ? '测试通过。' : ''}「${profile.name}」已保存${useAfterSave ? '并设为当前连接' : '，未切换连接'}。`);
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : '保存失败，请重试'); }
    finally { savingRef.current = false; if (alive.current) setSaving(false); }
  };
  const close = () => { if (!savingRef.current) { job.current?.abort(); referenceJob.current?.abort(); onClose(); } };

  return <div className="v091-modal-backdrop api-settings-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section className="v091-local-api-modal api-settings-modal" role="dialog" aria-modal="true" aria-labelledby="apiSettingsTitle">
      <header className="api-settings-header">
        <div className="api-settings-heading"><span className="api-settings-kicker">KAIPAI / MODEL CONNECTIONS</span><h2 id="apiSettingsTitle">让模型，<em>接入创作。</em></h2><p>填地址与 Key → 获取模型 → 选择用途 → 测试并保存</p></div>
        <span className="api-settings-mark" aria-hidden="true">AI<span>↗</span></span>
        <button type="button" className="api-settings-close" onClick={close} aria-label="关闭 AI 设置">×</button>
      </header>
      <div className="api-settings-body">
        <aside className="api-connections" aria-label="已绑定的连接">
          <div className="api-connections-title"><h3>我的连接</h3><span>{String(profiles.length).padStart(2, '0')}</span></div>
          <button type="button" className={`api-add-connection ${!editingId ? 'selected' : ''}`} disabled={busy} onClick={() => loadProfile('')}>＋ 新增连接</button>
          {!profiles.length && <p className="api-connections-empty">本机、云端，都能接入。<br />每个地址独立保存。</p>}
          <div className="api-connection-list">{profiles.map(profile => {
            const active = roles.textId === profile.id || roles.imageId === profile.id;
            return <div key={profile.id} className={`api-connection-card ${editingId === profile.id ? 'selected' : ''}`}>
              <button type="button" className="api-connection-edit" disabled={busy} onClick={() => loadProfile(profile.id)} aria-pressed={editingId === profile.id}><span className="api-connection-tag">{isLocalApi(profile.baseUrl) ? 'LOCAL' : 'CLOUD'}{active && <b>使用中</b>}</span><strong>{profile.name}</strong><small>{profile.baseUrl}</small></button>
              <button type="button" className="api-connection-activate" disabled={busy || active && roles.textId === (profile.models.text ? profile.id : '') && roles.imageId === (profile.models.image ? profile.id : '')} onClick={() => activate(profile)}>{active ? '正在使用' : '使用已保存配置 ↗'}</button>
            </div>;
          })}</div>
        </aside>
        <fieldset className="api-settings-scroll" disabled={busy} style={{ border: 0, margin: 0, minWidth: 0 }}>
          <div className="api-editor-heading"><h3><span>01</span>{editingId ? '编辑连接' : '添加连接'}</h3>{editingId && <button className="api-endpoint-reset" type="button" onClick={removeConnection}>移除</button>}</div>
          <div className="api-form-field api-name-field"><label htmlFor="apiConnectionName">连接名称 <span className="api-label-optional">选填</span></label><input id="apiConnectionName" value={profileName} maxLength={48} onChange={event => setProfileName(event.target.value)} placeholder="例如：本机服务、日常写作" /></div>
        <div className="api-form-field"><label htmlFor="apiEndpoint">API 地址</label><input id="apiEndpoint" value={endpoint} onChange={event => { clearDirectory(); setEndpoint(event.target.value); setTextModel(''); setImageModel(''); setTextAdapter(/\/responses\/?$/.test(event.target.value.trim()) ? 'openai-responses' : 'openai-chat'); if (isSealedCredential(apiKey)) setApiKey(''); }} placeholder="https://example.com/v1" autoComplete="off" /></div>
        <div className="api-form-field"><label htmlFor="apiKey">API Key</label><div className="api-key-field"><input id="apiKey" type={keyVisible ? 'text' : 'password'} value={isSealedCredential(apiKey) ? '' : apiKey} onChange={event => { clearDirectory(); setApiKey(event.target.value); }} placeholder={isSealedCredential(apiKey) ? '已保存，无需重填' : '粘贴服务提供的 Key'} autoComplete="off" /><button type="button" disabled={isSealedCredential(apiKey)} onClick={() => setKeyVisible(current => !current)}>{keyVisible ? '隐藏' : '显示'}</button><button className="api-discover" type="button" onClick={discover} disabled={!endpoint.trim() || !apiKey.trim()}>{stage === 'loading' ? '正在识别…' : stage === 'ready' ? '重新获取' : '获取模型'}</button></div></div>

        {directoryNote && <p className="api-directory-status" role="status">{directoryNote}</p>}

        {stage === 'fallback' && <div className="api-reference-directory">
          <p>官方参考目录 · 未从当前接口识别，不代表当前服务可用。也可直接填写模型名。</p>
          <div className="api-reference-row"><label htmlFor="referenceProvider">参考厂商</label><select id="referenceProvider" disabled={referenceBusy} value={referenceProvider} onChange={event => void loadReferences(event.target.value as ReferenceProvider)}>{Object.keys(REFERENCE_SOURCES).map(provider => <option key={provider}>{provider}</option>)}</select><button type="button" disabled={referenceBusy} onClick={() => void loadReferences(referenceProvider)}>{referenceBusy ? '更新中…' : '更新'}</button></div>
          <p className="api-sync-help" role="status">{referenceNote} <a href={REFERENCE_SOURCES[referenceProvider].url} target="_blank" rel="noopener noreferrer">来源 ↗</a></p>
        </div>}
        <div className="api-editor-heading api-model-heading"><h3><span>02</span>选择模型</h3><small>{showModels ? '可搜索或直接填写' : '识别后选择，也可手动填写'}</small></div>
        <div className="api-quick-models">
          <ModelPicker id="apiTextModel" label="文章模型" value={textModel} models={models} source={stage === 'fallback' ? '官方参考 · 待测试' : stage === 'ready' ? '接口返回 · 待测试' : '手动填写 · 待测试'} kind="text" onChange={model => { setTextModel(model); setNotice(''); setError(''); }} />
          <ModelPicker id="apiImageModel" label="封面模型（可选）" value={imageModel} models={models} source={stage === 'fallback' ? '官方参考 · 待测试' : stage === 'ready' ? '接口返回 · 待测试' : '手动填写 · 待测试'} kind="image" onChange={model => { setImageModel(model); setNotice(''); setError(''); }} />
        </div>
        <p className="api-connection-help">文章与封面可分别选择。封面留空即可只使用文字功能。</p>
      </fieldset>
      </div>
      {(error || notice) && <div className={`api-feedback ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
      <footer className="api-settings-actions"><div className="api-save-note"><label className="api-use-after-save"><input type="checkbox" checked={useAfterSave} disabled={busy} onChange={event => setUseAfterSave(event.target.checked)} />保存后使用此连接</label><span>测试会调用模型并使用额度。仅保存不产生调用。</span></div><div className="api-footer-buttons"><button type="button" className="api-test" disabled={saving || stage === 'loading' || (!testing && !textModel.trim() && !imageModel.trim())} onClick={() => void testConnection()}>{testing ? '取消测试' : '测试'}</button><button type="button" disabled={busy || (!textModel.trim() && !imageModel.trim())} onClick={() => void save()}>{saving ? '保存中…' : useAfterSave ? '保存并使用' : '保存'}</button><button type="button" className="api-save" disabled={busy || (!textModel.trim() && !imageModel.trim())} onClick={() => void testConnection(true)}>测试并保存<span aria-hidden="true">↗</span></button></div></footer>
    </section>
  </div>;
}
