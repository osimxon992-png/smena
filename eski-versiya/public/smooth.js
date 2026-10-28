// Silliq (inersiyali) aylantirish: Lenis sichqoncha g'ildiragini yumshatadi, telefonda tabiiy aylantirish qoladi.
if (window.Lenis && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09 });
}
