'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

// Silliq (inersiyali) aylantirish va PWA service worker. Telefonda tabiiy aylantirish qoladi.
export default function SmoothScroll() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);
  return null;
}
