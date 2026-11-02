'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/Lang';
import { currency, type Vars } from '@/lib/i18n';
import type { Shift } from '@/lib/client';

export type TagData = { role: string; pay: number; place: string; when: string; left: string; spent?: boolean; sample?: boolean };
type Sample = { role: string; pay: number; place: string; day: string; time: string; left: number; spent?: boolean };
type TFn = (key: string, vars?: Vars) => string;

export const SAMPLES: Sample[] = [
  { role: 'Ofitsiant', pay: 250000, place: 'Bahor to‘yxonasi, Yunusobod', day: 'Bugun', time: '18:00–23:00', left: 5 },
  { role: 'Buyurtma teruvchi', pay: 220000, place: 'Marketpleys ombori, Sergeli', day: 'Ertaga', time: '09:00–18:00', left: 7 },
  { role: 'Oshxona yordamchisi', pay: 200000, place: 'Milliy taomlar oshxonasi, Chilonzor', day: 'Shanba', time: '10:00–20:00', left: 2 },
  { role: 'Yuk tashuvchi', pay: 180000, place: 'Ko‘chish xizmati, Mirzo Ulug‘bek', day: 'Yakshanba', time: '08:00–14:00', left: 3 },
  { role: 'Promouter', pay: 150000, place: 'Savdo markazi, Olmazor', day: 'Bugun', time: '12:00–18:00', left: 0, spent: true },
];

// Namuna yorlig'i tanlangan tilda (joy nomlari o'zgarmaydi)
export const sampleTag = (x: Sample, t: TFn): TagData => ({
  role: t(x.role), pay: x.pay, place: x.place, when: `${t(x.day)}, ${x.time}`,
  left: x.spent ? t('Joy qolmadi') : t('{n} joy qoldi', { n: x.left }), spent: x.spent,
});
// Ipdagi o'rni (0–1) va ip uzunligi
const HANG = [[0.1, 28], [0.3, 44], [0.5, 22], [0.7, 40], [0.9, 26]];

export const fromShift = (s: Shift, t: TFn, day: (iso: string, withWeekday?: boolean) => string): TagData => ({
  role: s.title, pay: s.pay, place: `${s.org}, ${s.place}`,
  when: `${day(s.date, false)}, ${s.start_time}–${s.end_time}`, left: t('{n} joy qoldi', { n: (s.slots ?? 0) - (s.taken ?? 0) }),
  sample: !!s.demo, // admin qo'shgan demo smena "Namuna" muhri bilan
});

export default function HangingTags() {
  const { t, day, lang } = useT();
  // Jonli ochiq smenalar (ko'pi bilan 5 ta): ular namunalar o'rniga osiladi
  const [open, setOpen] = useState<Shift[]>([]);
  const live = open.length;
  const tags: TagData[] = [...open.map((s) => fromShift(s, t, day)), ...SAMPLES.slice(live).map((x) => ({ ...sampleTag(x, t), sample: live > 0 }))];
  const list = useRef<HTMLUListElement>(null);

  // Jonli smenalar bo'lsa namunalar o'rniga osiladi; kam bo'lsa qolgan joylar "Namuna" muhri bilan
  useEffect(() => {
    fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then((all: Shift[]) => {
      setOpen(all.filter((s) => (s.taken ?? 0) < (s.slots ?? 0)).slice(0, 5));
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
        <ul className="tags" ref={list} aria-label={t('Smenalar')}>
          {tags.map((tag, i) => (
            <li key={i} className="hang" style={{ '--p': HANG[i][0], '--len': `${HANG[i][1]}px` } as React.CSSProperties}>
              <article className={`tag${tag.spent ? ' is-spent' : ''}`}>
                <p className="tag-role">{tag.role}</p>
                <p className="tag-pay">{tag.pay.toLocaleString('ru-RU')} <small>{currency(lang)}</small></p>
                <p className="tag-place">{tag.place}</p>
                <p className="tag-when">{tag.when}</p>
                <p className="tag-left">{tag.left}</p>
                {tag.spent
                  ? <span className="tag-act" aria-disabled="true">{t('To‘ldi')}</span>
                  : <Link className="tag-act" href="/ilova/smenalar">{t('Ariza berish')}</Link>}
                {tag.sample && <span className="tag-sample">{t('Namuna')}</span>}
              </article>
            </li>
          ))}
        </ul>
      </div>
      <div className="board-foot wrap">
        <p className="sample-label">
          {live === 0 ? t('Namuna smenalar. Haqiqiylari') : live === 5 ? t('Hozir ochiq smenalar. Hammasi') : t('Birinchi {n} tasi hozir ochiq, qolganlari namuna. Hammasi', { n: live })}{' '}
          <Link href="/ilova/smenalar">{t('ilovada')}</Link>.
        </p>
        <Link className="sign sign-teal sign-rule taped" href="/qoidalar">
          <strong>{t('Kelmagan bloklanadi.')}</strong>
          <span>{t('Qabul qilingan smenaga kelmagan ishchi platformadan chiqariladi. Shuning uchun e’lon qo‘ygan biznesga odam keladi.')}</span>
        </Link>
      </div>
    </>
  );
}
