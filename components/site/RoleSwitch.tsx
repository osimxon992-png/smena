'use client';

import Link from 'next/link';
import { useState } from 'react';

const FLOWS = {
  worker: {
    label: 'Ish qidiryapman',
    steps: ['Ism, telefon va parol bilan ro‘yxatdan o‘ting.', 'Vaqti va haqi mos smenaga ariza bering.', 'Qabul qilinsangiz boring. Haqingizdan 15% Smena ulushi, qolgani sizniki.'],
    href: '/ilova/royxat',
    cta: 'Ishchi bo‘lib ro‘yxatdan o‘tish',
  },
  business: {
    label: 'Menga ishchi kerak',
    steps: ['Biznes nomi bilan ro‘yxatdan o‘ting.', 'Smena e’lon qiling: sana, vaqt, haq va odam soni.', 'Arizalardan tanlang, kelganlarni belgilang. E’lon va tanlov bepul.'],
    href: '/ilova/royxat?rol=biznes',
    cta: 'Biznes bo‘lib ro‘yxatdan o‘tish',
  },
};

// "Siz kimsiz?" — tanlangan tomon uchun uchta qadam va to'g'ri ro'yxatdan o'tish havolasi
export default function RoleSwitch() {
  const [role, setRole] = useState<keyof typeof FLOWS>('worker');
  const flow = FLOWS[role];
  return (
    <div className="widget sheet taped">
      <h2 className="widget-title">Siz kimsiz?</h2>
      <div className="pick-row" role="group" aria-label="Kimligingizni tanlang">
        {(Object.keys(FLOWS) as (keyof typeof FLOWS)[]).map((k) => (
          <button key={k} type="button" className="pick" aria-pressed={k === role} onClick={() => setRole(k)}>{FLOWS[k].label}</button>
        ))}
      </div>
      <ol className="widget-steps" key={role} aria-live="polite">
        {flow.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <Link className="btn" href={flow.href}>{flow.cta}</Link>
    </div>
  );
}
