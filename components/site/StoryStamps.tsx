'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/Lang';
import { currency } from '@/lib/i18n';

const STEPS = [
  ['Ariza berasiz', 'Ro‘yxatdan o‘tib, vaqti va haqi to‘g‘ri keladigan smenani tanlaysiz. Ariza bitta tugma bilan ketadi.'],
  ['Biznes sizni qabul qiladi', 'Ish beruvchi reytingingiz va bajargan smenalaringizni ko‘rib qaror qiladi. Qabul qilingan zahoti bir-biringizning raqamingiz ochiladi.'],
  ['Borasiz va ishlaysiz', 'Smenadan oldin Telegram’da eslatma keladi. Joyiga yetib kelgach “Keldim” ni bosasiz, ish beruvchi sizni “keldi” deb belgilaydi. Rejangiz o‘zgarsa, kamida bir kun oldin bekor qiling: bu bepul.'],
  ['Bir-biringizni baholaysiz', 'Siz ish beruvchini, u sizni beshtagacha yulduz bilan baholaydi. Reytingingiz keyingi arizalaringizda ish beruvchilarga ko‘rinadi.'],
];
const STAMPS = ['Ariza berildi', 'Qabul qilindi', 'Keldi', '5 baho'];

// Qadam ekran o'rtasiga kelganda namuna yorliqqa muhr tushadi
export default function StoryStamps() {
  const [state, setState] = useState(0);
  const steps = useRef<HTMLOListElement>(null);
  const { t, lang } = useT();

  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) setState(Number((e.target as HTMLElement).dataset.step));
    }), { rootMargin: '-45% 0px -45% 0px' });
    steps.current!.querySelectorAll('li').forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, []);

  return (
    <div className="story-grid">
      <div className="story-pin">
        <div className="story-tag" data-state={state}>
          <article className="tag">
            <p className="tag-role">{t('Ofitsiant')}</p>
            <p className="tag-pay">250 000 <small>{currency(lang)}</small></p>
            <p className="tag-place">Bahor to‘yxonasi, Yunusobod</p>
            <p className="tag-when">{t('Shanba')}, 18:00–23:00</p>
            <p className="tag-phone">{t('Ish beruvchi raqami:')} <span>{state >= 2 ? '+998 90 123 45 67' : t('qabuldan keyin ochiladi')}</span></p>
            <div className="stamps" aria-live="polite">
              {STAMPS.map((text, i) => <span key={text} className={`stamp s${i + 1}${i < state ? ' on' : ''}`}>{t(text)}</span>)}
            </div>
          </article>
        </div>
        <p className="sample-note">{t('Namuna smena')}</p>
      </div>
      <ol className="steps" ref={steps}>
        {STEPS.map(([title, text], i) => (
          <li key={title} data-step={i + 1}><h3>{t(title)}</h3><p>{t(text)}</p></li>
        ))}
      </ol>
    </div>
  );
}
