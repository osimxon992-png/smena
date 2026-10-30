'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { day, type Shift } from '@/lib/client';

export type TagData = { role: string; pay: number; place: string; when: string; left: string; spent?: boolean; sample?: boolean };

export const SAMPLES: TagData[] = [
  { role: 'Ofitsiant', pay: 250000, place: 'Bahor to‘yxonasi, Yunusobod', when: 'Bugun, 18:00–23:00', left: '5 joy qoldi' },
  { role: 'Buyurtma teruvchi', pay: 220000, place: 'Marketpleys ombori, Sergeli', when: 'Ertaga, 09:00–18:00', left: '7 joy qoldi' },
  { role: 'Oshxona yordamchisi', pay: 200000, place: 'Milliy taomlar oshxonasi, Chilonzor', when: 'Shanba, 10:00–20:00', left: '2 joy qoldi' },
  { role: 'Yuk tashuvchi', pay: 180000, place: 'Ko‘chish xizmati, Mirzo Ulug‘bek', when: 'Yakshanba, 08:00–14:00', left: '3 joy qoldi' },
  { role: 'Promouter', pay: 150000, place: 'Savdo markazi, Olmazor', when: 'Bugun, 12:00–18:00', left: 'Joy qolmadi', spent: true },
];
// Ipdagi o'rni (0–1) va ip uzunligi
const HANG = [[0.1, 28], [0.3, 44], [0.5, 22], [0.7, 40], [0.9, 26]];

export const fromShift = (s: Shift): TagData => ({
  role: s.title, pay: s.pay, place: `${s.org}, ${s.place}`,
  when: `${day(s.date, false)}, ${s.start_time}–${s.end_time}`, left: `${(s.slots ?? 0) - (s.taken ?? 0)} joy qoldi`,
});

export default function HangingTags() {
  const [tags, setTags] = useState(SAMPLES);
  const [live, setLive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  // Jonli smenalar bo'lsa namunalar o'rniga osiladi; kam bo'lsa qolgan joylar "Namuna" muhri bilan
  useEffect(() => {
    fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then((all: Shift[]) => {
      const open = all.filter((s) => (s.taken ?? 0) < (s.slots ?? 0)).slice(0, 5);
      if (!open.length) return;
      setTags([...open.map(fromShift), ...SAMPLES.slice(open.length).map((t) => ({ ...t, sample: true }))]);
      setLive(open.length);
    });
  }, []);

  // Yorliqlar aylantirish tezligiga qarab tebranadi (so'nuvchi prujina).
  // Faqat ip ekranda ko'rinayotganda ishlaydi; boshqa paytda har kadrda uslub yozib, sahifani sekinlatmaydi.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ul = list.current!;
    let angle = 0, speed = 0, lastY = scrollY, frame = 0, visible = true;
    const paint = () => ul.querySelectorAll<HTMLElement>('.hang').forEach((h, i) => h.style.setProperty('--swing', `${(angle * (i % 2 ? 0.8 : 1.15)).toFixed(2)}deg`));
    const step = () => {
      speed = (speed - angle * 0.06) * 0.9;
      angle = Math.max(-8, Math.min(8, angle + speed));
      paint();
      frame = Math.abs(angle) > 0.02 || Math.abs(speed) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    const onScroll = () => {
      const y = scrollY;
      if (visible) {
        speed += Math.max(-1.5, Math.min(1.5, (y - lastY) * 0.03));
        if (!frame) frame = requestAnimationFrame(step);
      }
      lastY = y;
    };
    const seen = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) return;
      // Ekrandan chiqqanda tinchlantiramiz: qaytganda tik osilib turadi
      cancelAnimationFrame(frame);
      frame = 0; angle = 0; speed = 0;
      paint();
    });
    seen.observe(ul);
    addEventListener('scroll', onScroll, { passive: true });
    return () => { seen.disconnect(); removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  return (
    <>
      <div className="stall">
        <svg className="twine" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true"><path d="M-12 8 Q500 72 1012 8" /></svg>
        <ul className="tags" ref={list} aria-label="Smenalar">
          {tags.map((t, i) => (
            <li key={i} className="hang" style={{ '--p': HANG[i][0], '--len': `${HANG[i][1]}px` } as React.CSSProperties}>
              <article className={`tag${t.spent ? ' is-spent' : ''}`}>
                <p className="tag-role">{t.role}</p>
                <p className="tag-pay">{t.pay.toLocaleString('ru-RU')} <small>so‘m</small></p>
                <p className="tag-place">{t.place}</p>
                <p className="tag-when">{t.when}</p>
                <p className="tag-left">{t.left}</p>
                {t.spent
                  ? <span className="tag-act" aria-disabled="true">To‘ldi</span>
                  : <Link className="tag-act" href="/ilova/smenalar">Ariza berish</Link>}
                {t.sample && <span className="tag-sample">Namuna</span>}
              </article>
            </li>
          ))}
        </ul>
      </div>
      <div className="board-foot wrap">
        <p className="sample-label">
          {live === 0 ? 'Namuna smenalar. Haqiqiylari ' : live === 5 ? 'Hozir ochiq smenalar. Hammasi ' : `Birinchi ${live} tasi hozir ochiq, qolganlari namuna. Hammasi `}
          <Link href="/ilova/smenalar">ilovada</Link>.
        </p>
        <Link className="sign sign-teal sign-rule taped" href="/qoidalar">
          <strong>Kelmagan bloklanadi.</strong>
          <span>Qabul qilingan smenaga kelmagan ishchi platformadan chiqariladi. Shuning uchun e’lon qo‘ygan biznesga odam keladi.</span>
        </Link>
      </div>
    </>
  );
}
