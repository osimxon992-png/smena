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
    const move = () => {
      if (!rows.classList.contains('pinned')) return;
      const done = Math.min(1, Math.max(0, (scrollY - rows.offsetTop) / (rows.offsetHeight - innerHeight)));
      strip.style.transform = `translateX(${-done * (strip.scrollWidth - innerWidth)}px)`;
      setActive(at(done));
    };
    const onStrip = () => setActive(at(strip.scrollLeft / Math.max(1, strip.scrollWidth - strip.clientWidth)));
    const layout = () => {
      const on = wide.matches && !calm;
      rows.classList.toggle('pinned', on);
      rows.style.height = on ? `${strip.scrollWidth - innerWidth + innerHeight}px` : '';
      strip.style.transform = '';
      move();
    };
    layout();
    document.fonts?.ready.then(layout);
    addEventListener('scroll', move, { passive: true });
    strip.addEventListener('scroll', onStrip, { passive: true });
    addEventListener('resize', layout);
    wide.addEventListener('change', layout);
    return () => {
      removeEventListener('scroll', move);
      strip.removeEventListener('scroll', onStrip);
      removeEventListener('resize', layout);
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
