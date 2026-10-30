'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { deleteGeneratedImage, listGeneratedImagePage, type GeneratedImage, type GeneratedImageCursor } from '../../lib/generated-images';

/** New saves and older pages share one list; loading never discards pictures already visible. */
export function useGeneratedImageHistory(setImages: Dispatch<SetStateAction<GeneratedImage[]>>) {
  const next = useRef<GeneratedImageCursor | null | undefined>(undefined);
  const busy = useRef(false);
  const mounted = useRef(false);
  const revision = useRef(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const loadMore = useCallback(async () => {
    if (!mounted.current || busy.current || next.current === null) return;
    busy.current = true;
    const version = ++revision.current;
    setLoading(true);
    setError('');
    try {
      const page = await listGeneratedImagePage(next.current);
      if (!mounted.current || revision.current !== version) return;
      setImages(current => {
        const unique = new Map(current.map(image => [image.id, image]));
        for (const image of page.images) if (!unique.has(image.id)) unique.set(image.id, image);
        return Array.from(unique.values()).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
      });
      next.current = page.nextCursor;
      setHasMore(Boolean(page.nextCursor));
    } catch {
      if (mounted.current && revision.current === version) setError('图片加载失败，已显示的图片仍可使用。请重试；若其他旧页面未关闭，请先关闭后重试。');
    } finally {
      if (mounted.current && revision.current === version) { busy.current = false; setLoading(false); }
    }
  }, [setImages]);
  const removeImage = useCallback(async (id: string): Promise<boolean> => {
    // Serialize deletes and page reads: a page started before deletion must not restore the image.
    if (!mounted.current || busy.current) return false;
    busy.current = true;
    const version = ++revision.current;
    setDeletingId(id);
    setDeleteError('');
    try {
      await deleteGeneratedImage(id);
      if (mounted.current && revision.current === version) setImages(current => current.filter(image => image.id !== id));
      // Keep the original seek boundary even when that image was deleted.
      return true;
    } catch {
      if (mounted.current && revision.current === version) setDeleteError('删除未完成，请重试；已显示的图片未移除。');
      return false;
    } finally {
      if (mounted.current && revision.current === version) { busy.current = false; setDeletingId(''); }
    }
  }, [setImages]);
  useEffect(() => {
    mounted.current = true;
    void loadMore();
    return () => { mounted.current = false; revision.current++; busy.current = false; };
  }, [loadMore]);
  return { loading, hasMore, error, loadMore, deletingId, deleteError, removeImage };
}
