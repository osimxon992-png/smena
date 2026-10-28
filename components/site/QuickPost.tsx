'use client';

import Link from 'next/link';
import { useState } from 'react';

const ROLES = ['Ofitsiant', 'Idish yuvuvchi', 'Oshxona yordamchisi', 'Buyurtma teruvchi', 'Yuk ortuvchi', 'Promouter'];

// "Kim kerak?" — lavozim va odam sonini tanlab, tayyor to'ldirilgan smena formasiga o'tish
export default function QuickPost() {
  const [role, setRole] = useState(ROLES[0]);
  const [count, setCount] = useState(3);
  const change = (d: number) => setCount((c) => Math.min(50, Math.max(1, c + d)));
  return (
    <div className="widget sheet taped">
      <h2 className="widget-title">Kim kerak?</h2>
      <div className="pick-row" role="group" aria-label="Lavozimni tanlang">
        {ROLES.map((r) => (
          <button key={r} type="button" className="pick" aria-pressed={r === role} onClick={() => setRole(r)}>{r}</button>
        ))}
      </div>
      <p className="widget-q">Necha kishi?</p>
      <div className="stepper">
        <button type="button" onClick={() => change(-1)} aria-label="Bittaga kamaytirish" disabled={count <= 1}>−</button>
        <output aria-live="polite">{count}</output>
        <button type="button" onClick={() => change(1)} aria-label="Bittaga ko‘paytirish" disabled={count >= 50}>+</button>
      </div>
      <p className="widget-sum">{count} ta {role.toLowerCase()} uchun smena e’loni tayyorlanadi.</p>
      <Link className="btn" href={`/ilova/yangi?lavozim=${encodeURIComponent(role)}&soni=${count}`}>Shu smenani e’lon qilish</Link>
    </div>
  );
}
