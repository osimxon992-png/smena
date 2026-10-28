'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

let lenis: Lenis | null = null;

// Sahifaning istalgan joyiga silliq o'tish (Lenis bo'lmasa brauzerning o'zi)
export function smoothScrollTo(y: number) {
  if (lenis) lenis.scrollTo(y);
  else scrollTo({ top: y, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// Silliq (inersiyali) aylantirish va PWA service worker. Telefonda tabiiy aylantirish qoladi.
export default function SmoothScroll() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09 });
    return () => { lenis?.destroy(); lenis = null; };
  }, []);
  return null;
}
