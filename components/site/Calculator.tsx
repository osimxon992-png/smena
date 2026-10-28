'use client';

import { useState } from 'react';
import { som } from '@/lib/client';

// Komissiya: kelgan ishchilar haqining 15% i
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
          <div><dt>Ishchilarga</dt><dd>{som(pay * n)}</dd></div>
          <div className="fee"><dt>Smena komissiyasi, 15%</dt><dd>{som(Math.round(pay * n * 0.15))}</dd></div>
          <div><dt>Ishchi kelmasa</dt><dd>0 so‘m</dd></div>
        </dl>
        <p className="receipt-note">Komissiya faqat kelgan ishchilar uchun olinadi. Ishchilar uchun Smena bepul.</p>
      </form>
    </div>
  );
}
