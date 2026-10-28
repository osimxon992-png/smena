'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Who = 'all' | 'worker' | 'business';
type Item = { q: string; a: React.ReactNode; plain?: string; who: Who };

const FAQ: Item[] = [
  { who: 'worker', q: 'Ishchilar uchun pullimi?', a: 'Yo‘q. Ro‘yxatdan o‘tish, ariza berish va ishlash bepul. Komissiyani biznes to‘laydi.' },
  { who: 'all', q: 'Haqni kim va qachon to‘laydi?', a: 'Haqni ish beruvchi to‘laydi. To‘lov tartibini qabul qilingandan keyin telefon orqali kelishib olasiz.' },
  { who: 'worker', q: 'Bora olmasam nima bo‘ladi?', a: 'Smenadan kamida bir kun oldin arizani bekor qiling: bu bepul va reytingingizga ta’sir qilmaydi. Smena kuni bekor qilib bo‘lmaydi, qabul qilingan smenaga kelmasangiz hisobingiz bloklanadi.' },
  { who: 'worker', q: 'Telefon raqamimni kim ko‘radi?', a: 'Faqat sizni smenaga qabul qilgan ish beruvchi. Ariza bosqichida raqamingiz yashirin turadi.' },
  {
    who: 'business', q: 'Biznes sifatida qancha to‘layman?',
    a: <>Har bir kelgan ishchi haqining 15%. Ishchi kelmasa, hech narsa to‘lamaysiz. Hisob-kitobni <Link href="/bizneslar#hisob">bizneslar sahifasida</Link> ko‘ring.</>,
    plain: 'Har bir kelgan ishchi haqining 15%. Ishchi kelmasa, hech narsa to‘lamaysiz. Hisob-kitob komissiya narx',
  },
  { who: 'business', q: 'Bitta smenaga necha kishi olsa bo‘ladi?', a: 'Bitta e’londa 1 dan 50 kishigacha. Joylar to‘lgach, e’lon ro‘yxatda “Joy qolmadi” bo‘lib turadi.' },
  {
    who: 'all', q: 'Ilovani qanday o‘rnataman?',
    a: <>Do‘kondan yuklab olish shart emas: saytni telefon brauzerida oching va “Bosh ekranga qo‘shish”ni tanlang. Batafsil <Link href="/qanday-ishlaydi#ornatish">bu yerda</Link>.</>,
    plain: 'Do‘kondan yuklab olish shart emas: saytni telefon brauzerida oching va Bosh ekranga qo‘shish ni tanlang. telefon ilova o‘rnatish',
  },
];

const WHO: [Who, string][] = [['all', 'Hammasi'], ['worker', 'Ishchilarga'], ['business', 'Bizneslarga']];
// Apostrof turlari (‘ ’ ' `) farq qilmasin: "bo'lsa" va "bo‘lsa" bir xil topiladi
const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ'`]/g, '');

// Savollar ro'yxati va o'ngdagi qidiruv paneli: so'z bo'yicha qidirish, kimga tegishliligi bo'yicha saralash, hammasini ochish
export default function FaqBrowser() {
  const [query, setQuery] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Bosh sahifadagi "Javob topish" dan kelgan ?q=
  useEffect(() => { setQuery(new URLSearchParams(location.search).get('q') ?? ''); }, []);

  const words = norm(query).split(/\s+/).filter(Boolean);
  const shown = FAQ.filter((f) => (who === 'all' || f.who === who || f.who === 'all')
    && words.every((w) => norm(`${f.q} ${f.plain ?? f.a}`).includes(w)));
  const allOpen = shown.length > 0 && shown.every((f) => open.has(f.q));
  const toggle = (q: string, isOpen: boolean) => setOpen((s) => {
    if (s.has(q) === isOpen) return s;
    const next = new Set(s);
    if (isOpen) next.add(q); else next.delete(q);
    return next;
  });

  return (
    <section className="section faq wrap" aria-label="Savol va javoblar">
      <div className="faq-layout">
        <div className="faq-list">
          {shown.map((f) => (
            <details key={f.q} open={open.has(f.q)} onToggle={(e) => toggle(f.q, e.currentTarget.open)}>
              <summary>{f.q}</summary><p>{f.a}</p>
            </details>
          ))}
          {!shown.length && <p className="empty">Bunday savol topilmadi. Boshqa so‘z bilan qidiring yoki filtrni “Hammasi”ga qaytaring.</p>}
        </div>
        <aside className="faq-aside widget sheet taped">
          <h2 className="widget-title">Savolingizni toping</h2>
          <label className="sr" htmlFor="faq-q">Savollar ichidan qidirish</label>
          <input id="faq-q" className="search-input" type="search" placeholder="Masalan: telefon, bekor, 15%" value={query} onChange={(e) => setQuery(e.target.value)} />
          <p className="widget-q">Kim uchun?</p>
          <div className="pick-row" role="group" aria-label="Kim uchun">
            {WHO.map(([k, label]) => (
              <button key={k} type="button" className="pick" aria-pressed={k === who} onClick={() => setWho(k)}>{label}</button>
            ))}
          </div>
          <div className="faq-aside-foot">
            <span aria-live="polite">{shown.length} ta savol</span>
            <button type="button" className="btn btn-line" disabled={!shown.length}
              onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((f) => f.q)))}>
              {allOpen ? 'Hammasini yopish' : 'Hammasini ochish'}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
