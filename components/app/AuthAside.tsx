'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Calculator from '@/components/site/Calculator';
import { SAMPLES, fromShift } from '@/components/site/HangingTags';
import { som, type Me, type Shift } from '@/lib/client';

type Role = Me['role'];

// Ishchi uchun: haftasiga nechta smena olsa, qancha topadi
function Earnings({ avgPay }: { avgPay: number }) {
  const [pay, setPay] = useState(avgPay);
  const [n, setN] = useState(3);
  return (
    <div className="receipt-wrap">
      <form className="receipt" aria-labelledby="earn-title" onSubmit={(e) => e.preventDefault()}>
        <h3 id="earn-title">Qancha topasiz?</h3>
        <label>Bir smena haqi <output>{som(pay)}</output>
          <input type="range" min={100000} max={500000} step={10000} value={pay} onChange={(e) => setPay(+e.target.value)} /></label>
        <label>Haftasiga <output>{n} ta smena</output>
          <input type="range" min={1} max={7} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <dl>
          <div><dt>Bir haftada</dt><dd>{som(pay * n)}</dd></div>
          <div className="fee"><dt>To‘rt haftada</dt><dd>{som(pay * n * 4)}</dd></div>
          <div><dt>Smena komissiyasi</dt><dd>0 so‘m</dd></div>
        </dl>
        <p className="receipt-note">Ishchilar uchun Smena bepul: komissiyani faqat biznes to‘laydi.</p>
      </form>
    </div>
  );
}

// Kirish va ro'yxat sahifalarining yon tomoni: ipdagi jonli smenalar va tanlangan rol uchun hisob-kitob.
// onRole berilsa (kirish sahifasi), rolni shu yerda tanlash mumkin; aks holda rol formadagi tanlovga ergashadi.
export default function AuthAside({ role, onRole }: { role: Role; onRole?: (r: Role) => void }) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  useEffect(() => { fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then(setShifts); }, []);

  const open = (shifts ?? []).filter((s) => (s.taken ?? 0) < (s.slots ?? 0));
  const tags = [...open.slice(0, 3).map(fromShift), ...SAMPLES.filter((t) => !t.spent).slice(0, 3 - Math.min(open.length, 3)).map((t) => ({ ...t, sample: true }))];
  // Ishchi kalkulyatori jonli smenalarning o'rtacha haqidan boshlanadi
  const avgPay = open.length ? Math.round(open.reduce((a, s) => a + s.pay, 0) / open.length / 10000) * 10000 : 200000;

  return (
    <aside className="auth-aside" aria-label="Smena haqida">
      <section className="auth-board">
        <h2 className="widget-title">{open.length ? `Hozir ochiq: ${open.length} ta smena` : 'Smenalar shunday osiladi'}</h2>
        <ul className="pegs" aria-busy={shifts === null}>
          {tags.map((t, i) => (
            <li key={i} className="peg" style={{ '--tilt': `${[-3, 2, -1.5][i]}deg` } as React.CSSProperties}>
              <Link className="tag" href="/ilova/smenalar">
                <span className="tag-role">{t.role}</span>
                <span className="tag-pay">{t.pay.toLocaleString('ru-RU')} <small>so‘m</small></span>
                <span className="tag-when">{t.when}</span>
                <span className="tag-left">{t.left}</span>
                {t.sample && <span className="tag-sample">Namuna</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="aside-calc">
        {onRole && (
          <div className="pick-row" role="group" aria-label="Kim uchun hisoblash">
            {([['worker', 'Ishchi'], ['business', 'Biznes']] as [Role, string][]).map(([r, label]) => (
              <button key={r} type="button" className="pick" aria-pressed={r === role} onClick={() => onRole(r)}>{label}</button>
            ))}
          </div>
        )}
        {role === 'worker' ? <Earnings key={avgPay} avgPay={avgPay} /> : <Calculator />}
      </section>
    </aside>
  );
}
