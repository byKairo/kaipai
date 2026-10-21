export type LocalAsset = {
  id: string;
  name: string;
  url: string;
  note: string;
  tags: Array<'avatar' | 'qrcode' | 'cover' | 'body'>;
  createdAt: number;
};

export const ASSET_STORAGE_KEY = 'kaipai.assets.v1';

export function listAssets(): LocalAsset[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ASSET_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((asset): asset is LocalAsset => Boolean(asset && typeof asset === 'object' && typeof (asset as LocalAsset).id === 'string' && typeof (asset as LocalAsset).url === 'string')).map((asset) => ({ ...asset, tags: Array.isArray(asset.tags) ? asset.tags : [] }));
  } catch { return []; }
}

export function saveAssets(assets: LocalAsset[]) {
  localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(assets));
}
