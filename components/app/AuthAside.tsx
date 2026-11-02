'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Calculator from '@/components/site/Calculator';
import { SAMPLES, fromShift, sampleTag } from '@/components/site/HangingTags';
import { currency } from '@/lib/i18n';
import { SHARE, type Me, type Shift } from '@/lib/client';
import { useT } from '@/components/Lang';

type Role = Me['role'];

// Ishchi uchun: haftasiga nechta smena olsa, Smena ulushidan keyin qo'liga qancha qoladi
function Earnings({ avgPay }: { avgPay: number }) {
  const [pay, setPay] = useState(avgPay);
  const [n, setN] = useState(3);
  const { t, som } = useT();
  return (
    <div className="receipt-wrap">
      <form className="receipt" aria-labelledby="earn-title" onSubmit={(e) => e.preventDefault()}>
        <h3 id="earn-title">{t('Qancha topasiz?')}</h3>
        <label>{t('Bir smena haqi')} <output>{som(pay)}</output>
          <input type="range" min={100000} max={500000} step={10000} value={pay} onChange={(e) => setPay(+e.target.value)} /></label>
        <label>{t('Haftasiga')} <output>{t('{n} ta smena', { n })}</output>
          <input type="range" min={1} max={7} value={n} onChange={(e) => setN(+e.target.value)} /></label>
        <dl>
          <div><dt>{t('Bir haftada topasiz')}</dt><dd>{som(pay * n)}</dd></div>
          <div><dt>{t('Smena ulushi, {pct}%', { pct: SHARE * 100 })}</dt><dd>−{som(Math.round(pay * n * SHARE))}</dd></div>
          <div className="fee"><dt>{t('To‘rt haftada qo‘lingizga')}</dt><dd>{som(Math.round(pay * n * 4 * (1 - SHARE)))}</dd></div>
        </dl>
        <p className="receipt-note">{t('Ulush faqat bajarilgan smenadan olinadi: kelmagan yoki bekor qilingan smenadan 0 so‘m.')}</p>
      </form>
    </div>
  );
}

// Kirish va ro'yxat sahifalarining yon tomoni: ipdagi jonli smenalar va tanlangan rol uchun hisob-kitob.
// onRole berilsa (kirish sahifasi), rolni shu yerda tanlash mumkin; aks holda rol formadagi tanlovga ergashadi.
export default function AuthAside({ role, onRole }: { role: Role; onRole?: (r: Role) => void }) {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const { t, lang, day } = useT();
  useEffect(() => { fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then(setShifts); }, []);

  const open = (shifts ?? []).filter((s) => (s.taken ?? 0) < (s.slots ?? 0));
  const tags = [...open.slice(0, 3).map((s) => fromShift(s, t, day)), ...SAMPLES.filter((x) => !x.spent).slice(0, 3 - Math.min(open.length, 3)).map((x) => ({ ...sampleTag(x, t), sample: true }))];
  // Ishchi kalkulyatori jonli smenalarning o'rtacha haqidan boshlanadi
  const avgPay = open.length ? Math.round(open.reduce((a, s) => a + s.pay, 0) / open.length / 10000) * 10000 : 200000;

  return (
    <aside className="auth-aside" aria-label={t('Smena haqida')}>
      <section className="auth-board">
        <h2 className="widget-title">{open.length ? t('Hozir ochiq: {n} ta smena', { n: open.length }) : t('Smenalar shunday osiladi')}</h2>
        <ul className="pegs" aria-busy={shifts === null}>
          {tags.map((tag, i) => (
            <li key={i} className="peg" style={{ '--tilt': `${[-3, 2, -1.5][i]}deg` } as React.CSSProperties}>
              <Link className="tag" href="/ilova/smenalar">
                <span className="tag-role">{tag.role}</span>
                <span className="tag-pay">{tag.pay.toLocaleString('ru-RU')} <small>{currency(lang)}</small></span>
                <span className="tag-when">{tag.when}</span>
                <span className="tag-left">{tag.left}</span>
                {tag.sample && <span className="tag-sample">{t('Namuna')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="aside-calc">
        {onRole && (
          <div className="pick-row" role="group" aria-label={t('Kim uchun hisoblash')}>
            {([['worker', 'Ishchi'], ['business', 'Biznes']] as [Role, string][]).map(([r, label]) => (
              <button key={r} type="button" className="pick" aria-pressed={r === role} onClick={() => onRole(r)}>{t(label)}</button>
            ))}
          </div>
        )}
        {role === 'worker' ? <Earnings key={avgPay} avgPay={avgPay} /> : <Calculator />}
      </section>
    </aside>
  );
}
