import assert from 'node:assert/strict';
import { createRequestScopeState } from '../app/workspace/use-request-scope';
import type { AiResult } from '../lib/providers';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Minimal hook scheduler; requests deliberately resolve after abort to exercise stale-result guards. */
function hookHarness() {
  const values: any[] = [], effects: Array<{ deps: unknown[]; cleanup?: () => void }> = [];
  let cursor = 0;
  return {
    begin() { cursor = 0; },
    dispose() { effects.forEach(effect => effect?.cleanup?.()); },
    react: {
      useRef(value: unknown) { const index = cursor++; return values[index] ?? (values[index] = { current: value }); },
      useState(value: unknown) {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof value === 'function' ? value() : value;
        return [values[index], (next: any) => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
      },
      useEffect(callback: () => (() => void) | void, deps: unknown[]) {
        const index = cursor++, previous = effects[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() || undefined };
        }
      },
    },
  };
}

export async function run() {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const actionsFile = require.resolve('../app/workspace/use-ai-actions');
  const reviewFile = require.resolve('../app/workspace/use-article-review');
  const previousCache = new Map([actionsFile, reviewFile].map(file => [file, require.cache[file]]));
  for (const file of Array.from(previousCache.keys())) delete require.cache[file];
  const actionsHooks = hookHarness(), reviewHooks = hookHarness();
  const globals = new Map(['Image', 'document', 'FileReader'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const setGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value });
  const requests: Array<{ signal: AbortSignal; response: ReturnType<typeof deferred<AiResult>> }> = [];
  const imageRequests: Array<{ signal: AbortSignal; response: ReturnType<typeof deferred<Response>> }> = [];
  const saved: any[] = [];
  let saveSignal: AbortSignal | undefined;
  let saveGate: ReturnType<typeof deferred<void>> | undefined;
  let decodeGate: ReturnType<typeof deferred<void>> | undefined;
  let pendingEncode: ((blob: Blob) => void) | undefined;
  let pauseEncoding = false;
  let decoded = 0, canvases = 0, reads = 0, parsed = 0;
  const drawn: number[][] = [];
  const dispatched: any[] = [];
  const settle = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
  setGlobal('Image', class {
    src = ''; naturalWidth = 1600; naturalHeight = 900;
    decode() { decoded++; return decodeGate?.promise || Promise.resolve(); }
  });
  setGlobal('document', { createElement(tag: string) {
    assert.equal(tag, 'canvas'); canvases++;
    return { width: 0, height: 0,
      getContext() { return { drawImage(_image: unknown, ...coordinates: number[]) { drawn.push(coordinates); } }; },
      toBlob(callback: (value: Blob) => void, mime: string) {
        assert.equal(mime, 'image/png');
        if (pauseEncoding) pendingEncode = callback;
        else queueMicrotask(() => callback(new Blob(['png'], { type: mime })));
      },
      toDataURL() { throw new Error('Synchronous image encoding must not be used'); },
    };
  } });
  setGlobal('FileReader', class {
    result = 'data:image/png;base64,cG5n'; error = null;
    onload?: () => void; onabort?: () => void;
    readAsDataURL(_blob: Blob) { reads++; queueMicrotask(() => this.onload?.()); }
    abort() { this.onabort?.(); }
  });
  Module._load = function(request: string, parent: any, ...rest: any[]) {
    const file = parent?.filename;
    if (file === actionsFile || file === reviewFile) {
      if (request === 'react') return (file === actionsFile ? actionsHooks : reviewHooks).react;
      if (request === '../../lib/providers') return { requestAi(_body: unknown, signal?: AbortSignal) {
        assert.ok(signal, 'Every AI request must receive its request-scope signal');
        const response = deferred<AiResult>(); requests.push({ signal, response }); return response.promise;
      } };
    }
    if (file === actionsFile && request === '../../lib/ai-transport') return { aiFetch(_url: string, init: RequestInit) {
      assert.ok(init.signal, 'Image transport must receive its request-scope signal');
      const response = deferred<Response>(); imageRequests.push({ signal: init.signal, response }); return response.promise;
    } };
    if (file === actionsFile && request === '../../lib/generated-images') return { async saveGeneratedImage(image: unknown, signal?: AbortSignal) {
      assert.ok(signal, 'Image storage must receive the same cancellation signal');
      saveSignal = signal; await saveGate?.promise;
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      saved.push(image);
    } };
    if (file === reviewFile && request === '../../lib/article-review-client') return {
      parseArticleSuggestions(value: any) { parsed++; return value.suggestions; },
      getArticleReviewController(view: any) { return {
        clear() { view.dispatch({ type: 'set', items: [] }); },
        locate(suggestions: unknown[]) { return suggestions; },
        set(items: unknown[]) { view.dispatch({ type: 'set', items }); },
      }; },
    };
    return originalLoad.call(this, request, parent, ...rest);
  };
  try {
    const { useAiActions } = require(actionsFile);
    const { useArticleReview } = require(reviewFile);
    const scope = createRequestScopeState(); scope.update('article-a', '正文');
    const aiState: any = { aiRevision: null, aiImageCards: [], savedGeneratedImages: [] };
    for (const name of ['AiImageCards', 'SavedGeneratedImages', 'AiResultMode', 'AiPhase', 'AiRecommendation', 'AiSummary', 'AiTitleOptions', 'AiSuggestions', 'AiImageBriefs', 'AiRevision', 'RevisionInstruction']) {
      const key = name[0].toLowerCase() + name.slice(1);
      aiState[`set${name}`] = (next: any) => { aiState[key] = typeof next === 'function' ? next(aiState[key]) : next; };
    }
    const context: any = { state: aiState, content: '正文', articleId: 'article-a', style: 0, accent: '#000',
      apiProfiles: [{ id: 'connection', provider: 'Custom', baseUrl: 'http://127.0.0.1:1234/v1', apiKey: 'test-only', models: { image: 'image-model' }, modelConfigs: [{ id: 'image', modelId: 'image-model', capabilities: ['image-generation'], adapter: 'openai-images' }], adapters: { image: 'openai-images' } }],
      apiRoles: { imageId: 'connection', imageModelId: 'image' }, apiProvider: 'Custom', apiModel: 'text-model', textApiKey: 'test-only', textBaseUrl: 'http://127.0.0.1:1234/v1', assets: [], brandAvatarAssetId: '', brandQrAssetId: '', brandName: '', brandNote: '',
      requestScope: scope, richEditorRef: { current: null }, chooseStyle() {}, loadMarkdown() {}, say() {}, setApiOpen() {},
    };
    const renderActions = () => { actionsHooks.begin(); return useAiActions(context); };
    const actions = renderActions();
    const responseImage = () => Response.json({ ok: true, src: 'data:image/png;base64,b3JpZ2luYWw=' });
    const startImage = (id: string) => {
      aiState.aiImageCards = [{ id, status: 'idle', src: '' }];
      return actions.generateAiImage(id, '简报', '画面要求');
    };

    const oldImage = startImage('old');
    const oldRequest = imageRequests.at(-1)!;
    scope.update('article-b', '另一篇');
    assert.ok(oldRequest.signal.aborted, 'Switching articles aborts the image request');
    oldRequest.response.resolve(responseImage()); await oldImage;
    assert.equal(decoded, 0, 'Late network responses must not start image decoding');
    assert.equal(canvases, 0); assert.equal(saved.length, 0);

    decodeGate = deferred<void>();
    const decoding = startImage('decode');
    imageRequests.at(-1)!.response.resolve(responseImage()); await settle();
    assert.equal(decoded, 1);
    scope.cancel('image:decode');
    decodeGate.resolve(); await decoding; decodeGate = undefined;
    assert.equal(canvases, 0, 'Cancellation while decoding must skip canvas processing');
    assert.equal(saved.length, 0);

    pauseEncoding = true;
    const encoding = startImage('encode');
    imageRequests.at(-1)!.response.resolve(responseImage()); await settle();
    assert.ok(pendingEncode);
    scope.update('article-b', '已修改正文');
    pendingEncode(new Blob(['png'], { type: 'image/png' })); await encoding;
    pauseEncoding = false; pendingEncode = undefined;
    assert.equal(reads, 0, 'Cancelled encoding must not convert or save the PNG');
    assert.equal(saved.length, 0);

    const normal = startImage('normal');
    const normalRequest = imageRequests.at(-1)!;
    normalRequest.response.resolve(responseImage()); await normal;
    assert.equal(saved.length, 1, 'A current image must still reach storage');
    assert.equal(saveSignal, normalRequest.signal);
    assert.equal(saved[0].src, 'data:image/png;base64,cG5n');
    assert.equal(aiState.aiImageCards[0].status, 'done');
    assert.equal(aiState.savedGeneratedImages.length, 1);
    assert.deepEqual(drawn.at(-1), [200, 0, 1200, 900, 0, 0, 1200, 900], 'Existing centered 4:3 cropping is preserved');

    saveGate = deferred<void>();
    const saving = startImage('saving');
    const savingRequest = imageRequests.at(-1)!;
    savingRequest.response.resolve(responseImage()); await settle();
    assert.equal(saveSignal, savingRequest.signal);
    scope.cancel('image:saving'); saveGate.resolve(); await saving; saveGate = undefined;
    assert.ok(savingRequest.signal.aborted);
    assert.equal(saved.length, 1, 'An interrupted storage operation must not add the stale image');
    assert.equal(aiState.savedGeneratedImages.length, 1);

    const revision = { kind: 'polish', original: '原文', proposal: '', alternatives: [], from: 1, to: 3, wasHeading: false, status: 'running' };
    const oldRevision = actions.makeRevision(revision);
    const oldRevisionRequest = requests.at(-1)!;
    // This is the dialog's close contract: cancel the channel and clear the visible proposal.
    scope.cancel('revision'); aiState.setAiRevision(null);
    assert.ok(oldRevisionRequest.signal.aborted);
    const newRevision = actions.makeRevision(revision);
    requests.at(-1)!.response.resolve({ ok: true, text: '新建议', model: 'test' }); await newRevision;
    oldRevisionRequest.response.resolve({ ok: true, text: '已关闭的旧建议', model: 'test' }); await oldRevision;
    assert.equal(aiState.aiRevision.proposal, '新建议', 'A late closed revision must not overwrite the next proposal');

    const doc = { eq(other: unknown) { return other === doc; } };
    const editor = { isDestroyed: false, getText: () => '正文', state: { doc }, view: { dispatch(tr: unknown) { dispatched.push(tr); } } };
    const reviewOptions = { content: '正文', articleId: 'article-b', editorRef: { current: editor }, scope, connection: { provider: 'Custom', apiKey: 'test-only', prompt: '' }, configure() {}, say() {} };
    const renderReview = () => { reviewHooks.begin(); return useArticleReview(reviewOptions); };
    let review = renderReview();
    const oldReview = review.run(); const oldReviewRequest = requests.at(-1)!;
    review.cancel();
    assert.ok(oldReviewRequest.signal.aborted, 'The review cancel action must abort transport');
    oldReviewRequest.response.resolve({ ok: true, text: '{"suggestions":[{"id":"obsolete"}]}', model: 'test' }); await oldReview;
    review = renderReview();
    assert.equal(review.phase, 'idle'); assert.equal(parsed, 0, 'Cancelled review results are discarded before parsing');
    assert.deepEqual(dispatched, [{ type: 'set', items: [] }], 'Cancelled review must not add editor decorations');
    const currentReview = review.run();
    requests.at(-1)!.response.resolve({ ok: true, text: '{"suggestions":[{"id":"current"}]}', model: 'test' }); await currentReview;
    review = renderReview();
    assert.equal(review.phase, 'ready');
    assert.deepEqual(dispatched.at(-1), { type: 'set', items: [{ id: 'current' }] });
    console.log('PASS: AI abort propagation, stale image processing/storage refusal, normal image crop/save, closed revisions and cancelled reviews');
  } finally {
    actionsHooks.dispose(); reviewHooks.dispose();
    Module._load = originalLoad;
    for (const [file, cached] of Array.from(previousCache)) { delete require.cache[file]; if (cached) require.cache[file] = cached; }
    for (const [name, descriptor] of Array.from(globals)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  }
}
