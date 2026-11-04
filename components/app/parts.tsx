'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { useT } from '@/components/Lang';
import { directionsUrl, meters, type Review, type Shift, type Trust } from '@/lib/client';
import { useApp } from './AppShell';

// picked — xaritada bosilgan smena (ro'yxatda ajralib turadi)
export function Ticket({ s, children, picked }: { s: Shift; children?: React.ReactNode; picked?: boolean }) {
  const { t, day, som } = useT();
  return (
    <article className={`ticket${s.urgent ? ' is-urgent' : ''}${picked ? ' is-picked' : ''}`} id={`smena-${s.id}`}>
      <div className="ticket-time">
        <span className="ticket-day">{day(s.date)}</span>
        <span className="ticket-clock">{s.start_time}</span>
        <span className="ticket-until">{t('{time} gacha', { time: s.end_time })}</span>
      </div>
      <div className="ticket-body">
        {(s.urgent || s.invited || s.fav) ? (
          <p className="ticket-flags">
            {s.urgent ? <span className="flag flag-urgent">🔥 {t('Shoshilinch')}</span> : null}
            {s.invited ? <span className="flag flag-invite">💌 {t('Sizni taklif qilishdi')}</span> : null}
            {s.fav ? <span className="flag flag-fav">★ {t('Sizni sevimli ishchi qilgan')}</span> : null}
          </p>
        ) : null}
        <h2 className="ticket-title">{s.title}</h2>
        {s.org && (
          <p className="ticket-org">
            {s.business_id ? <Link href={`/ilova/tashkilot/${s.business_id}`}>{s.org}</Link> : s.org}
            {s.org_rating ? <> <span className="stars">★ {s.org_rating}</span></> : null}
            {s.org_done ? <> <span className="muted">· {t('{n} ta smena bajarilgan', { n: s.org_done })}</span></> : null}
            {s.org_paid != null ? <> <span className="muted">· 💸 {t('{pct}% o‘z vaqtida to‘laydi', { pct: s.org_paid })}</span></> : null}
          </p>
        )}
        <p className="ticket-place">
          {s.place}{s.org_district ? <span className="muted"> · {s.org_district}</span> : null}
          {s.distance != null ? <b className="dist"> · {t('{dist} uzoqlikda', { dist: meters(s.distance) })}</b> : null}
          {' '}<a className="directions" href={directionsUrl(s)} target="_blank" rel="noreferrer">🧭 {t('Yo‘l ko‘rsatish')}</a>
        </p>
        {s.note && <p className="ticket-note">{s.note}</p>}
        <div className="ticket-foot">
          <strong className="pay">{som(s.pay)}</strong>
          {s.slots ? <span className="slots">{t('{taken}/{slots} joy band', { taken: s.taken ?? 0, slots: s.slots })}</span> : null}
        </div>
        {children && <div className="ticket-aside">{children}</div>}
      </div>
    </article>
  );
}

// Ishchiga ishonch: belgi (yangi / ishonchli / top), kelish foizi, baho, bajargan smenalar va "Keldim" belgilagani
const BADGES = { new: 'Yangi ishchi', reliable: 'Ishonchli', top: 'Top ishchi' } as const;
export function TrustLine({ trust }: { trust: Trust }) {
  const { t } = useT();
  const parts = [
    trust.reliability !== null && t('Kelish: {pct}%', { pct: trust.reliability }),
    trust.rating && `★ ${trust.rating}`,
    t('{n} ta smena bajargan', { n: trust.done }),
    trust.noshows ? t('{n} marta kelmagan', { n: trust.noshows }) : null,
    trust.checkins ? t('{n} marta “Keldim” belgilagan', { n: trust.checkins }) : null,
  ].filter(Boolean);
  return (
    <p className="trust">
      {trust.badge && <span className={`badge badge-${trust.badge}`}>{t(BADGES[trust.badge])}</span>}
      <span className="muted">{parts.join(' · ')}</span>
    </p>
  );
}

export const Empty = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="empty"><h2>{title}</h2><p>{children}</p></div>
);

export const Field = ({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) => (
  <label className={`field ${className}`}><span>{label}</span>{children}</label>
);

export const PhoneInput = () => (
  <div className="phone"><span>+998</span><input type="tel" name="phone" required inputMode="tel" autoComplete="tel-national" placeholder="90 123 45 67" /></div>
);

// Ro'yxatdagi rol, ism va biznes nomi maydonlari (biznes nomi faqat "Menga ishchi kerak" tanlanganda ko'rinadi)
export function ProfileFields({ business, name }: { business: boolean; name?: string }) {
  const { t } = useT();
  return (
    <>
      <fieldset className="roles">
        <legend>{t('Siz kimsiz?')}</legend>
        <label><input type="radio" name="role" value="worker" defaultChecked={!business} /><span>{t('Ish qidiryapman')}</span></label>
        <label><input type="radio" name="role" value="business" defaultChecked={business} /><span>{t('Menga ishchi kerak')}</span></label>
      </fieldset>
      <Field label={t('Ismingiz')}><input name="name" required maxLength={60} autoComplete="name" defaultValue={name} /></Field>
      <Field label={t('Biznes nomi')} className="org"><input name="org" maxLength={80} placeholder={t('Bahor to‘yxonasi')} /></Field>
    </>
  );
}

export function BlockedBanner() {
  const { me } = useApp();
  const { t } = useT();
  if (!me?.blocked) return null;
  return <p className="banner danger">{t('Qabul qilingan smenaga kelmaganingiz uchun hisobingiz bloklangan. Yangi smenalarga ariza bera olmaysiz.')}</p>;
}

// Bir bosishli amal: bajarilguncha o'chadi, natijani xabar qiladi (done — matn yoki natijadan matn)
export function ActionButton<R>({ className = 'btn', run, done, confirmText, children }: {
  className?: string; run: () => Promise<R>; done: string | ((result: R) => string); confirmText?: string; children: React.ReactNode;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  async function click() {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try { const r = await run(); toast(typeof done === 'function' ? done(r) : done); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
  }
  return <button type="button" className={className} disabled={busy} onClick={click}>{children}</button>;
}

// Yuborilganda maydonlarni obyekt qilib beradi (bir nomli bir nechta maydon kerak bo'lsa, ikkinchi argumentdagi FormData'dan); xatoni forma ostida ko'rsatadi
export function useSubmit(handler: (body: Record<string, string>, form: FormData) => Promise<unknown>) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try { await handler(Object.fromEntries(form) as Record<string, string>, form); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return { onSubmit, error, busy };
}

// Baho va ixtiyoriy yozma sharh (300 belgigacha)
export function StarsForm({ id, legend, button, onRate, placeholder }: {
  id: string; legend: string; button: string; onRate: (rating: number, review: string) => Promise<unknown>; placeholder?: string;
}) {
  const { t } = useT();
  const { onSubmit, error, busy } = useSubmit((b) => onRate(Number(b.rating), b.review ?? ''));
  return (
    <form className="rate" onSubmit={onSubmit}>
      <fieldset>
        <legend>{legend}</legend>
        <div className="stars-input">
          {/* Kirish va yorliq aka-uka bo'lishi shart: CSS ~ selektori yulduzlarni shunday bo'yaydi */}
          {[5, 4, 3, 2, 1].map((n) => (
            <Fragment key={n}>
              <input type="radio" name="rating" value={n} id={`r${id}-${n}`} required />
              <label htmlFor={`r${id}-${n}`}><span aria-hidden="true">★</span><span className="sr">{t('{n} baho', { n })}</span></label>
            </Fragment>
          ))}
        </div>
      </fieldset>
      <label className="sr" htmlFor={`rv${id}`}>{t('Sharh (ixtiyoriy)')}</label>
      <textarea id={`rv${id}`} className="review-input" name="review" rows={2} maxLength={300} placeholder={placeholder ?? t('Bir-ikki gap yozing (ixtiyoriy)')} />
      <button className="btn" type="submit" disabled={busy}>{button}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

// Sharhlar ro'yxati: baho, matn, kim va qachon
export function Reviews({ items, empty }: { items: Review[]; empty?: string }) {
  const { t, day } = useT();
  if (!items.length) return empty ? <p className="hint">{empty}</p> : null;
  return (
    <ul className="reviews">
      {items.map((r, i) => (
        <li key={i}>
          <p><span className="stars">{'★'.repeat(r.rating)}<span className="stars-off">{'★'.repeat(5 - r.rating)}</span></span>
            <span className="muted"> · {[r.author ?? r.org, r.title, day(r.date, false)].filter(Boolean).join(' · ')}</span></p>
          {r.text ? <p className="review-text">“{r.text}”</p> : <p className="hint">{t('Sharhsiz baho')}</p>}
        </li>
      ))}
    </ul>
  );
}
