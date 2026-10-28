'use client';

import { useEffect, useRef, useState } from 'react';
import { smoothScrollTo } from '@/components/SmoothScroll';
import Wipe from './Wipe';

const TYPES = [
  ['To‘yxonalar', 'Ofitsiant, idish yuvuvchi, stol yig‘uvchi', 'Ko‘pincha kechqurun va dam olish kunlari.', 'paper'],
  ['Restoran va kafe', 'Oshxona yordamchisi, kassir, ofitsiant', 'Tushlik va kechki gavjum soatlar.', 'teal'],
  ['Omborlar', 'Buyurtma teruvchi, qadoqlovchi, yuk ortuvchi', 'Kunduzgi va tungi smenalar.', 'ink'],
  ['Topshirish punktlari', 'Operator, saralovchi', 'Aksiya va bayram oldidagi kunlar.', 'kraft'],
  ['Tadbirlar', 'Promouter, garderobchi, mehmonlarni kutib oluvchi', 'Ko‘rgazma, konsert va ochilish marosimlari.', 'paper'],
  ['Ko‘chish va yuk', 'Yuk tashuvchi, mebel yig‘uvchi yordamchi', 'Ertalabdan tushgacha.', 'teal'],
];

// Katta ekranda vertikal aylantirish peshtaxtalarni yonga suradi; telefonda oddiy gorizontal lenta.
// O'ngdagi ko'rsatkich qaysi peshtaxtadaligingizni ko'rsatadi va bosilsa o'shanga olib boradi.
export default function ShiftTypes() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const rows = section.current!, strip = track.current!;
    const wide = matchMedia('(min-width: 900px)');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Ko'rsatkich yo'lning qancha qismi o'tilganiga mutanosib: oxirgi peshtaxtalar ham o'z raqamini oladi
    const at = (done: number) => Math.round(done * (TYPES.length - 1));
    let current = 0;
    const show = (i: number) => { if (i !== current) setActive((current = i)); };

    // O'lchamlar faqat layout() da o'qiladi: scroll paytida sahifa joylashuvini qayta hisoblatmaslik uchun
    const geo = { pinned: false, top: 0, travel: 1, shift: 0, done: -1 };
    const move = () => {
      if (!geo.pinned) return;
      const done = Math.min(1, Math.max(0, (scrollY - geo.top) / geo.travel));
      if (done === geo.done) return;
      geo.done = done;
      strip.style.transform = `translateX(${-done * geo.shift}px)`;
      show(at(done));
    };
    const onStrip = () => show(at(strip.scrollLeft / Math.max(1, strip.scrollWidth - strip.clientWidth)));
    const layout = () => {
      geo.pinned = wide.matches && !calm;
      rows.classList.toggle('pinned', geo.pinned);
      const height = geo.pinned ? `${strip.scrollWidth - innerWidth + innerHeight}px` : '';
      if (rows.style.height !== height) rows.style.height = height;
      geo.top = rows.getBoundingClientRect().top + scrollY;
      geo.travel = Math.max(1, rows.offsetHeight - innerHeight);
      geo.shift = strip.scrollWidth - innerWidth;
      geo.done = -1;
      strip.style.transform = '';
      move();
    };
    layout();
    document.fonts?.ready.then(layout);
    // Yuqoridagi bloklar balandligi o'zgarsa (shrift, jonli smenalar), boshlanish nuqtasi ham yangilanadi
    const resized = new ResizeObserver(layout);
    resized.observe(document.body);
    addEventListener('scroll', move, { passive: true });
    strip.addEventListener('scroll', onStrip, { passive: true });
    wide.addEventListener('change', layout);
    return () => {
      resized.disconnect();
      removeEventListener('scroll', move);
      strip.removeEventListener('scroll', onStrip);
      wide.removeEventListener('change', layout);
    };
  }, []);

  function go(i: number) {
    const rows = section.current!, strip = track.current!;
    const done = i / (TYPES.length - 1);
    if (rows.classList.contains('pinned')) smoothScrollTo(rows.offsetTop + done * (rows.offsetHeight - innerHeight));
    else strip.scrollTo({ left: done * (strip.scrollWidth - strip.clientWidth), behavior: 'smooth' });
  }

  return (
    <section ref={section} className="section rows" id="turlar" aria-labelledby="rows-title">
      <div className="rows-pin">
        <div className="wrap rows-head">
          <div>
            <Wipe id="rows-title">Qanday smenalar bo‘ladi</Wipe>
            <p className="lead">Bir kunga qo‘shimcha odam kerak bo‘ladigan har qanday joy. Eng ko‘p uchraydiganlari:</p>
          </div>
          <nav className="rows-index" aria-label="Smena turlari">
            <span className="rows-count" aria-hidden="true">{active + 1}/{TYPES.length}</span>
            {TYPES.map(([title], i) => (
              <button key={title} type="button" className="pick" aria-pressed={i === active} onClick={() => go(i)}>{title}</button>
            ))}
          </nav>
        </div>
        <div ref={track} className="rows-track">
          {TYPES.map(([title, roles, when, tone]) => (
            <article key={title} className={`stall-sign stall-${tone}`}>
              <h3>{title}</h3>
              <p className="roles-line">{roles}</p>
              <p className="when-line">{when}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
