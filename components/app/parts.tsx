'use client';

import { Fragment, useState } from 'react';
import { day, som, type Shift } from '@/lib/client';
import { useApp } from './AppShell';

export function Ticket({ s, children }: { s: Shift; children?: React.ReactNode }) {
  return (
    <article className="ticket">
      <div className="ticket-time">
        <span className="ticket-day">{day(s.date)}</span>
        <span className="ticket-clock">{s.start_time}</span>
        <span className="ticket-until">{s.end_time} gacha</span>
      </div>
      <div className="ticket-body">
        <h2 className="ticket-title">{s.title}</h2>
        {s.org && <p className="ticket-org">{s.org}{s.org_rating ? <> <span className="stars">★ {s.org_rating}</span></> : null}</p>}
        <p className="ticket-place">{s.place}</p>
        {s.note && <p className="ticket-note">{s.note}</p>}
        <div className="ticket-foot">
          <strong className="pay">{som(s.pay)}</strong>
          {s.slots ? <span className="slots">{s.taken}/{s.slots} joy band</span> : null}
        </div>
        {children && <div className="ticket-aside">{children}</div>}
      </div>
    </article>
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
export const ProfileFields = ({ business, name }: { business: boolean; name?: string }) => (
  <>
    <fieldset className="roles">
      <legend>Siz kimsiz?</legend>
      <label><input type="radio" name="role" value="worker" defaultChecked={!business} /><span>Ish qidiryapman</span></label>
      <label><input type="radio" name="role" value="business" defaultChecked={business} /><span>Menga ishchi kerak</span></label>
    </fieldset>
    <Field label="Ismingiz"><input name="name" required maxLength={60} autoComplete="name" defaultValue={name} /></Field>
    <Field label="Biznes nomi" className="org"><input name="org" maxLength={80} placeholder="Bahor to‘yxonasi" /></Field>
  </>
);

export function BlockedBanner() {
  const { me } = useApp();
  if (!me?.blocked) return null;
  return <p className="banner danger">Qabul qilingan smenaga kelmaganingiz uchun hisobingiz bloklangan. Yangi smenalarga ariza bera olmaysiz.</p>;
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
              <label htmlFor={`r${id}-${n}`}><span aria-hidden="true">★</span><span className="sr">{n} baho</span></label>
            </Fragment>
          ))}
        </div>
      </fieldset>
      <button className="btn" type="submit" disabled={busy}>{button}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
