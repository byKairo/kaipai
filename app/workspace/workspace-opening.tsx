'use client';

import { useEffect, useRef } from 'react';
import ui from './workspace-opening.module.css';
import { playOpening } from './workspace-opening-animation';

const artworkUrl = '/article-assets/kairo-design-opening.webp';
const openingLimitMs = 1950;
const sweepMs = 1700;
const lastFrameMs = 100;

export function WorkspaceOpening({ onComplete }: { onComplete?: () => void }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    const track = trackRef.current;
    const canvas = canvasRef.current;
    const image = stillRef.current;
    if (!screen || !track || !canvas || !image) return;

    let disposed = false;
    let finished = false;
    let stop: (() => void) | undefined;
    let holdTimer: number | undefined;
    const start = performance.now();
    const finish = () => {
      if (disposed || finished) return;
      finished = true;
      stop?.();
      onComplete?.();
    };
    const deadline = window.setTimeout(finish, openingLimitMs);
    const showStill = () => {
      if (disposed || finished) return;
      if (image.naturalWidth) track.dataset.visible = 'still';
      holdTimer = window.setTimeout(finish, 450);
    };
    void image.decode().then(() => {
      if (disposed || finished) return;
      const remaining = openingLimitMs - (performance.now() - start) - lastFrameMs;
      if (remaining < 250 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        showStill();
        return;
      }
      stop = playOpening(screen, track, canvas, image, Math.min(sweepMs, remaining), () => {
        holdTimer = window.setTimeout(finish, lastFrameMs);
      });
      if (!stop) showStill();
    }).catch(showStill);

    return () => {
      disposed = true;
      window.clearTimeout(deadline);
      window.clearTimeout(holdTimer);
      stop?.();
    };
  }, [onComplete]);

  return <div ref={screenRef} className={ui.screen} role="status" data-workspace-opening>
    <div className={ui.content}>
      <div ref={trackRef} className={ui.track} aria-hidden="true">
        {/* The local artwork is also the fallback when motion or Canvas is unavailable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={stillRef} alt="" src={artworkUrl} />
        <canvas ref={canvasRef} width={480} height={160} />
      </div>
      <p className={ui.status}>正在打开楷排…</p>
    </div>
  </div>;
}
