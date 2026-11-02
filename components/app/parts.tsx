'use client';

import { Fragment, useState } from 'react';
import { useT } from '@/components/Lang';
import type { Shift, Trust } from '@/lib/client';
import { useApp } from './AppShell';

export function Ticket({ s, children }: { s: Shift; children?: React.ReactNode }) {
  const { t, day, som } = useT();
  return (
    <article className="ticket">
      <div className="ticket-time">
        <span className="ticket-day">{day(s.date)}</span>
        <span className="ticket-clock">{s.start_time}</span>
        <span className="ticket-until">{t('{time} gacha', { time: s.end_time })}</span>
      </div>
      <div className="ticket-body">
        {(s.invited || s.fav) ? (
          <p className="ticket-flags">
            {s.invited ? <span className="flag flag-invite">💌 {t('Sizni taklif qilishdi')}</span> : null}
            {s.fav ? <span className="flag flag-fav">★ {t('Sizni sevimli ishchi qilgan')}</span> : null}
          </p>
        ) : null}
        <h2 className="ticket-title">{s.title}</h2>
        {s.org && (
          <p className="ticket-org">
            {s.org}{s.org_rating ? <> <span className="stars">★ {s.org_rating}</span></> : null}
            {s.org_done ? <> <span className="muted">· {t('{n} ta smena bajarilgan', { n: s.org_done })}</span></> : null}
          </p>
        )}
        <p className="ticket-place">{s.place}{s.org_district ? <span className="muted"> · {s.org_district}</span> : null}</p>
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

// Bir bosishli amal: bajarilguncha o'chadi, natijani xabar qiladi
export function ActionButton({ className = 'btn', run, done, confirmText, children }: {
  className?: string; run: () => Promise<unknown>; done: string; confirmText?: string; children: React.ReactNode;
}) {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  async function click() {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    try { await run(); toast(done); } catch (e) { toast((e as Error).message, true); } finally { setBusy(false); }
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

export function StarsForm({ id, legend, button, onRate }: { id: string; legend: string; button: string; onRate: (rating: number) => Promise<unknown> }) {
  const { t } = useT();
  const { onSubmit, error, busy } = useSubmit((b) => onRate(Number(b.rating)));
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
      <button className="btn" type="submit" disabled={busy}>{button}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
