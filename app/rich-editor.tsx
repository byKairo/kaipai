'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import type { Editor } from '@tiptap/core';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Markdown } from '@tiptap/markdown';
import type { ArticleDocument } from '../lib/document';
import { createArticleReviewPlugin, type ReviewState } from '../lib/article-review';

export type RichEditorProps = { value: string; document?: ArticleDocument | null; onChange: (document: ArticleDocument, markdown: string, edited?: boolean) => void; onReady: (editor: Editor | null) => void; htmlToImport?: string; onReviewState?: (state: ReviewState) => void };
const ArticleReview = Extension.create<{ onChange: (state: ReviewState) => void }>({
  name: 'articleReview',
  addOptions: () => ({ onChange: () => {} }),
  addProseMirrorPlugins() { return [createArticleReviewPlugin(this.options.onChange)]; },
});

function ImageWithCaptionView({ node, updateAttributes, selected }: NodeViewProps) {
  return <NodeViewWrapper as="figure" className={`v091-editor-image${selected ? ' selected' : ''}`}>
    <img src={String(node.attrs.src || '')} alt={String(node.attrs.alt || '')} draggable="false" />
    <input aria-label="图片说明" placeholder="点击填写图片说明" value={String(node.attrs.alt || '')} onChange={(event) => updateAttributes({ alt: event.target.value })} />
  </NodeViewWrapper>;
}

const CaptionImage = Image.extend({ addNodeView() { return ReactNodeViewRenderer(ImageWithCaptionView); } });

const CommunityBlock = Node.create({
  name: 'communityBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({ kind: { default: 'tip' } }),
  parseHTML: () => [{ tag: 'div[data-kaipai-component]' }],
  renderHTML: ({ HTMLAttributes }) => {
    const kind = HTMLAttributes.kind === 'tip' ? 'callout' : HTMLAttributes.kind === 'recs' ? 'recommendations' : HTMLAttributes.kind;
    return ['div', mergeAttributes(HTMLAttributes, { 'data-kaipai-component': HTMLAttributes.kind, class: `v091-editor-component ${kind}` }), 0];
  },
  markdownTokenizer: {
    name: 'communityBlock', level: 'block',
    start: (src: string) => src.search(/^:::(lead|tip|warn|follow|recs|recommendations|author|divider|callout|compare)\s*$/m),
    tokenize: (src: string) => {
      const match = src.match(/^:::(lead|tip|warn|follow|recs|recommendations|author|divider|callout|compare)\s*\r?\n([\s\S]*?)\r?\n:::(?:\r?\n|$)/);
      if (!match) return undefined;
      return { type: 'communityBlock', raw: match[0], kind: match[1], text: match[2] } as any;
    },
  },
  parseMarkdown: (token: any, helpers: any) => {
    const rawFields = ['follow', 'recs', 'recommendations', 'divider', 'compare'].includes(token.kind);
    const paragraphs = String(token.text || '').split(/\r?\n/).filter(Boolean).map((line) => {
      const content = rawFields ? [helpers.createTextNode(line)] : helpers.parseInline(helpers.tokenizeInline?.(line) || []);
      return helpers.createNode('paragraph', {}, content);
    });
    return helpers.createNode('communityBlock', { kind: token.kind }, paragraphs.length ? paragraphs : [helpers.createNode('paragraph', {}, [])]);
  },
  renderMarkdown: (node: any, helpers: any) => {
    const kind = node.attrs?.kind || 'tip';
    const body = String(helpers.renderChildren(node.content || [], '\n') || '').replace(/^\n+|\n+$/g, '');
    return `:::${kind}\n${body}\n:::`;
  },
});

export default function RichEditor({ value, document, onChange, onReady, htmlToImport, onReviewState }: RichEditorProps) {
  const reviewCallback = useRef(onReviewState);
  reviewCallback.current = onReviewState;
  // Parent echoes this same snapshot back. Only external document loads need a comparison.
  const emittedDocument = useRef<ArticleDocument | null>(null);
  const emitChange = (current: Editor, edited = false) => {
    const next = current.getJSON() as ArticleDocument;
    emittedDocument.current = next;
    onChange(next, current.getMarkdown(), edited);
  };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: false }), Highlight, CaptionImage, Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }), TableKit.configure({ table: { resizable: true } }), CommunityBlock, Markdown, ArticleReview.configure({ onChange: state => reviewCallback.current?.(state) })],
    content: value,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'v091-rich-editor', 'aria-label': '文章编辑区' } },
    onUpdate: ({ editor: current }) => emitChange(current, true),
  });

  useEffect(() => { onReady(editor); return () => onReady(null); }, [editor, onReady]);
  useEffect(() => {
    if (!editor || !document || document === emittedDocument.current) return;
    const next = JSON.stringify(document);
    if (JSON.stringify(editor.getJSON()) === next) { emittedDocument.current = document; return; }
    editor.commands.setContent(document, { emitUpdate: false });
    emitChange(editor);
  }, [editor, document, onChange]);
  useEffect(() => {
    // When `document` is provided (opening a saved article), it is the source of truth.
    // Syncing from markdown `value` here races and can restore the previous article into the editor.
    // External markdown loads (sample / history / import) must call editor.commands.setContent —
    // after the first onChange, `document` stays set so this value sync intentionally no-ops.
    if (!editor || editor.isFocused || document) return;
    const current = editor.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
      emitChange(editor);
    }
  }, [editor, value, document, onChange]);
  const lastHtmlImportRef = useRef<string>('');
  useEffect(() => {
    if (!editor || !htmlToImport || htmlToImport === lastHtmlImportRef.current) return;
    lastHtmlImportRef.current = htmlToImport;
    editor.commands.setContent(htmlToImport, { contentType: 'html', emitUpdate: false });
    emitChange(editor);
  }, [editor, htmlToImport, onChange]);

  return <EditorContent editor={editor} className="v091-rich-editor-shell" />;
}
