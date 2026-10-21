export type DocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
  text?: string;
};

export type ArticleDocument = {
  type: 'doc';
  content: DocumentNode[];
};

export type ArticleRecord = {
  id: string;
  title: string;
  content: ArticleDocument;
  markdown?: string;
  style: string;
  appearance?: {
    accent: string;
    markerColor: string;
    variant: string;
    fontSize: number;
    lineHeight: number;
    padX: number;
    padY: number;
    imageRadius: number;
    paragraphGap?: number;
    fontFamily?: string;
    fontColor?: string;
    headingStyle: string;
    headingIcon: string;
    headingMarkerColor?: string;
    headingLabel?: string;
    headingLabels?: Record<string, string>;
    headingPrefixes?: Record<string, string>;
    headingSeparators?: Record<string, string>;
    headingNumberFormat?: '01' | '1' | '一' | 'none';
    unorderedMarker: string;
    orderedMarker: string;
    paperMode?: 'follow' | 'style' | 'custom';
    paperColor?: string;
    paperTextureUrl?: string;
  };
  createdAt: number;
  updatedAt: number;
};

export const emptyDocument = (): ArticleDocument => ({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export function isArticleDocument(value: unknown): value is ArticleDocument {
  return Boolean(value && typeof value === 'object' && (value as ArticleDocument).type === 'doc' && Array.isArray((value as ArticleDocument).content));
}
