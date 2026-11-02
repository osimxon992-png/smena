'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/components/Lang';

const ROLES = ['Ofitsiant', 'Idish yuvuvchi', 'Oshxona yordamchisi', 'Buyurtma teruvchi', 'Yuk ortuvchi', 'Promouter'];

// "Kim kerak?" — lavozim va odam sonini tanlab, tayyor to'ldirilgan smena formasiga o'tish
export default function QuickPost() {
  const [role, setRole] = useState(ROLES[0]);
  const [count, setCount] = useState(3);
  const { t } = useT();
  const change = (d: number) => setCount((c) => Math.min(50, Math.max(1, c + d)));
  return (
    <div className="widget sheet taped">
      <h2 className="widget-title">{t('Kim kerak?')}</h2>
      <div className="pick-row" role="group" aria-label={t('Lavozimni tanlang')}>
        {ROLES.map((r) => (
          <button key={r} type="button" className="pick" aria-pressed={r === role} onClick={() => setRole(r)}>{t(r)}</button>
        ))}
      </div>
      <p className="widget-q">{t('Necha kishi?')}</p>
      <div className="stepper">
        <button type="button" onClick={() => change(-1)} aria-label={t('Bittaga kamaytirish')} disabled={count <= 1}>−</button>
        <output aria-live="polite">{count}</output>
        <button type="button" onClick={() => change(1)} aria-label={t('Bittaga ko‘paytirish')} disabled={count >= 50}>+</button>
      </div>
      <p className="widget-sum">{t('Smena e’loni tayyorlanadi: {role}, {n} kishi.', { role: t(role).toLowerCase(), n: count })}</p>
      <Link className="btn" href={`/ilova/yangi?lavozim=${encodeURIComponent(role)}&soni=${count}`}>{t('Shu smenani e’lon qilish')}</Link>
    </div>
  );
}
