'use client';

import { useState } from 'react';
import { SHARE } from '@/lib/client';
import { useT } from '@/components/Lang';

// Biznes uchun: e'lon va tanlov bepul, faqat ishchilarga haq to'lanadi; Smena ulushini ishchi o'z haqidan to'laydi
export default function Calculator() {
  const [pay, setPay] = useState(250000);
  const [n, setN] = useState(4);
  const { t, som } = useT();
  return (
    <div className="receipt-wrap">
      <form className="receipt" aria-labelledby="calc-title" onSubmit={(e) => e.preventDefault()}>
        <h3 id="calc-title">{t('Hisob-kitob')}</h3>
        <label>{t('Bir ishchining haqi')} <output>{som(pay)}</output>
          <input type="range" min={100000} max={600000} step={10000} value={pay} onChange={(e) => setPay(+e.target.value)} /></label>
        <label>{t('Kelgan ishchilar')} <output>{t('{n} kishi', { n })}</output>
          <input type="range" min={1} max={20} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <dl>
          <div><dt>{t('Ishchilarga to‘laysiz')}</dt><dd>{som(pay * n)}</dd></div>
          <div className="fee"><dt>{t('Siz uchun komissiya')}</dt><dd>{som(0)}</dd></div>
          <div><dt>{t('Har bir ishchi qo‘liga oladi')}</dt><dd>{som(Math.round(pay * (1 - SHARE)))}</dd></div>
        </dl>
        <p className="receipt-note">{t('E’lon qilish va ishchi tanlash biznes uchun bepul. Smena ulushini ({pct}%) ishchi o‘z haqidan to‘laydi.', { pct: SHARE * 100 })}</p>
      </form>
    </div>
  );
}
