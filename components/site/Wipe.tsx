'use client';

import { useEffect, useRef } from 'react';

// Sarlavha ekranga kirganda marker bilan "yoziladi". Allaqachon ko'rinib turgan sarlavha yashirilmaydi.
export default function Wipe({ id, className = 'h2', children }: { id?: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || el.getBoundingClientRect().top < innerHeight * 0.7) return;
    el.classList.add('armed');
    // Kesilgan (clip-path) element o'zi kuzatilmaydi: Chrome uni ko'rinmas deb hisoblaydi, shuning uchun ota-elementi kuzatiladi
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { rootMargin: '0px 0px -30% 0px' });
    io.observe(el.parentElement!);
    return () => io.disconnect();
  }, []);
  return <h2 ref={ref} id={id} className={`${className} wipe`}>{children}</h2>;
}
