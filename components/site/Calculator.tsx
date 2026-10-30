'use client';

import { useState } from 'react';
import { SHARE, som } from '@/lib/client';

// Biznes uchun: e'lon va tanlov bepul, faqat ishchilarga haq to'lanadi; Smena ulushini ishchi o'z haqidan to'laydi
export default function Calculator() {
  const [pay, setPay] = useState(250000);
  const [n, setN] = useState(4);
  return (
    <div className="receipt-wrap">
      <form className="receipt" aria-labelledby="calc-title" onSubmit={(e) => e.preventDefault()}>
        <h3 id="calc-title">Hisob-kitob</h3>
        <label>Bir ishchining haqi <output>{som(pay)}</output>
          <input type="range" min={100000} max={600000} step={10000} value={pay} onChange={(e) => setPay(+e.target.value)} /></label>
        <label>Kelgan ishchilar <output>{n} kishi</output>
          <input type="range" min={1} max={20} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <dl>
          <div><dt>Ishchilarga to‘laysiz</dt><dd>{som(pay * n)}</dd></div>
          <div className="fee"><dt>Siz uchun komissiya</dt><dd>0 so‘m</dd></div>
          <div><dt>Har bir ishchi qo‘liga oladi</dt><dd>{som(Math.round(pay * (1 - SHARE)))}</dd></div>
        </dl>
        <p className="receipt-note">E’lon qilish va ishchi tanlash biznes uchun bepul. Smena ulushini ({SHARE * 100}%) ishchi o‘z haqidan to‘laydi.</p>
      </form>
    </div>
  );
}
