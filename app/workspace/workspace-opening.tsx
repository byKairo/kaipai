'use client';

import { useEffect, useRef } from 'react';
import ui from './workspace-opening.module.css';

const artworkUrl = '/article-assets/kairo-design-opening.webp';
const showAfterMs = 180;

export function WorkspaceOpening() {
  const screenRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    const delay = window.setTimeout(() => {
      const screen = screenRef.current;
      const track = trackRef.current;
      const canvas = canvasRef.current;
      const image = stillRef.current;
      if (!screen || !track || !canvas || !image) return;

      image.src = artworkUrl;
      const still = () => {
        if (!disposed && image.naturalWidth) track.dataset.visible = 'still';
      };
      const decoded = image.decode();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void decoded.then(still, () => {});
        return;
      }
      void Promise.all([import('./workspace-opening-animation'), decoded])
        .then(([{ playOpening }]) => {
          if (!disposed) stop = playOpening(screen, track, canvas, image);
          if (!stop) still();
        })
        .catch(still);
    }, showAfterMs);

    return () => {
      disposed = true;
      window.clearTimeout(delay);
      stop?.();
    };
  }, []);

  return <div ref={screenRef} className={ui.screen} role="status" data-workspace-opening>
    <div className={ui.content}>
      <div ref={trackRef} className={ui.track} aria-hidden="true">
        {/* The local artwork is also the fallback when motion or Canvas is unavailable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={stillRef} alt="" fetchPriority="low" />
        <canvas ref={canvasRef} width={480} height={160} />
      </div>
      <p className={ui.status}>正在打开楷排…</p>
    </div>
  </div>;
}
