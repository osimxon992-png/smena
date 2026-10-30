'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, day, som, STATUS, type Status } from '@/lib/client';
import { PLANS, planName } from '@/lib/options';

export type Target = { kind: 'user' | 'shift'; id: number };
type Open = (t: Target) => void;

type UserCard = {
  user: {
    id: number; role: 'worker' | 'business'; name: string; org: string | null; phone: string; blocked: number | boolean; created_at: string; rating: number | null; done?: number;
    plan: 'free' | 'pro'; plan_until: string | null; ai_used: number; tts_used: number;
  };
  sessions: { active: number; last_login: string | null };
  applications: { id: number; status: Status; worker_rating: number | null; business_rating: number | null; shift_id: number; title: string; date: string; start_time: string; end_time: string; pay: number; org: string; org_phone: string }[];
  shifts: { id: number; title: string; place: string; date: string; start_time: string; end_time: string; pay: number; slots: number; note: string; taken: number; pending: number; came: number }[];
};
type ShiftCard = {
  shift: { id: number; title: string; place: string; date: string; start_time: string; end_time: string; pay: number; slots: number; note: string; created_at: string; org: string; org_phone: string; org_id: number; taken: number };
  applicants: { id: number; status: Status; worker_rating: number | null; business_rating: number | null; created_at: string; worker_id: number; name: string; phone: string; blocked: number }[];
};

const stars = (n: number | null) => (n ? `★ ${n}` : '—');
const Row = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="kv"><dt>{k}</dt><dd>{children}</dd></div>;
const Tel = ({ phone }: { phone: string }) => <a href={`tel:${phone}`}>{phone}</a>;
const MONTHS = [[1, '1 oy'], [3, '3 oy'], [6, '6 oy'], [12, '1 yil'], [0, 'Muddatsiz']] as const;

// Obunani o'zgartirish: Pro'ni yoqish yoki uzaytirish (amaldagi muddatga qo'shiladi), yoki bepulga qaytarish
function PlanControl({ user, onSave }: { user: UserCard['user']; onSave: (body: object) => void }) {
  const [months, setMonths] = useState<number>(1);
  const pro = user.plan === 'pro';
  return (
    <div className="plan-control">
      <p>
        <b>{planName(user.plan, user.role)}</b>{pro && <> · {user.plan_until ? `${user.plan_until} gacha` : 'muddatsiz'}</>}
        <span className="muted"> · bugun Farbo: {user.ai_used} / {PLANS[user.plan].ai} savol, {user.tts_used} / {PLANS[user.plan].tts} ovoz</span>
      </p>
      <div className="detail-actions">
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Pro muddati">
          {MONTHS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
        </select>
        <button type="button" className="btn btn-sm" onClick={() => onSave({ plan: 'pro', months })}>{pro ? 'Pro’ni uzaytirish' : 'Pro yoqish'}</button>
        {pro && <button type="button" className="btn btn-ghost btn-sm" onClick={() => confirm(`${user.name} bepul tarifga o‘tkazilsinmi?`) && onSave({ plan: 'free' })}>Bepulga o‘tkazish</button>}
      </div>
    </div>
  );
}

// O'ng tomondan ochiladigan tafsilot oynasi: foydalanuvchi yoki smena haqida hamma narsa
export default function Detail({ target, onOpen, onClose, onChanged }: { target: Target; onOpen: Open; onClose: () => void; onChanged: () => void }) {
  const [card, setCard] = useState<UserCard | ShiftCard | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [temp, setTemp] = useState('');

  const load = useCallback(() => {
    setCard(null);
    api<UserCard | ShiftCard>(`/admin/${target.kind === 'user' ? 'users' : 'shifts'}/${target.id}`).then(setCard).catch((e: Error) => setError(e.message));
  }, [target]);
  useEffect(() => { setError(''); setNote(''); setTemp(''); load(); }, [load]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);

  async function act(path: string, body: object, done: (r: any) => void) {
    setError('');
    try { done(await api(path, body)); load(); onChanged(); } catch (e) { setError((e as Error).message); }
  }

  let content: React.ReactNode = <p className="muted">Yuklanmoqda…</p>;
  if (card && 'user' in card) {
    const { user: u, sessions, applications, shifts } = card;
    content = (
      <>
        <h2 id="detail-title">{u.name}</h2>
        <p className="muted">{u.role === 'worker' ? 'Ishchi' : `Biznes: ${u.org}`} · #{u.id}</p>
        <dl className="kv-list">
          <Row k="Telefon"><Tel phone={u.phone} /></Row>
          <Row k="Holat">{u.blocked ? <span className="chip chip-noshow">Bloklangan</span> : <span className="chip chip-accepted">Faol</span>}</Row>
          <Row k="Reyting">{stars(u.rating)}</Row>
          {u.role === 'worker' && <Row k="Bajargan smenalari">{u.done ?? 0}</Row>}
          <Row k="Ro‘yxatdan o‘tgan">{u.created_at}</Row>
          <Row k="Faol kirishlar">{sessions.active} ta</Row>
          <Row k="Oxirgi kirish">{sessions.last_login ?? '—'}</Row>
          <Row k="Parol">Shifrlangan holda saqlanadi, ko‘rib bo‘lmaydi</Row>
        </dl>

        <div className="detail-actions">
          <button type="button" className={u.blocked ? 'btn btn-ghost btn-sm' : 'btn btn-danger btn-sm'}
            onClick={() => (u.blocked || confirm(`${u.name} bloklansinmi?`)) && act(`/admin/users/${u.id}`, { blocked: !u.blocked }, () => setNote(u.blocked ? 'Blokdan chiqarildi' : 'Bloklandi'))}>
            {u.blocked ? 'Blokdan chiqarish' : 'Bloklash'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => confirm(`${u.name} uchun yangi vaqtinchalik parol yaratilsinmi? Eski parol ishlamay qoladi.`) && act(`/admin/users/${u.id}/password`, {}, (r) => setTemp(r.password))}>
            Yangi parol berish
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!sessions.active}
            onClick={() => act(`/admin/users/${u.id}/logout`, {}, (r) => setNote(`${r.ended} ta kirish yopildi`))}>
            Barcha kirishlarni yopish
          </button>
        </div>
        {temp && (
          <div className="temp-pass" role="status">
            <p>Yangi vaqtinchalik parol (faqat hozir ko‘rinadi, foydalanuvchiga yetkazing):</p>
            <code>{temp}</code>
            <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(temp).then(() => setNote('Parol nusxalandi'))}>Nusxalash</button>
          </div>
        )}

        <h3 className="detail-h3">Obuna</h3>
        <PlanControl user={u} onSave={(body) => act(`/admin/users/${u.id}/plan`, body, (r) => setNote(r.plan === 'pro' ? `Pro yoqildi: ${r.plan_until ? `${r.plan_until} gacha` : 'muddatsiz'}` : 'Bepul tarifga o‘tkazildi'))} />

        {u.role === 'worker' ? (
          <>
            <h3 className="detail-h3">Arizalari ({applications.length})</h3>
            <table className="admin-table">
              <thead><tr><th>Smena</th><th>Sana</th><th className="num">Haq</th><th>Holat</th><th className="num">Baholar</th></tr></thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'shift', id: a.shift_id })}>{a.title}</button><small>{a.org}, <Tel phone={a.org_phone} /></small></td>
                    <td>{day(a.date, false)}, {a.start_time}</td>
                    <td className="num">{som(a.pay)}</td>
                    <td><span className={`chip chip-${a.status}`}>{STATUS[a.status]}</span></td>
                    <td className="num">{stars(a.worker_rating)} / {stars(a.business_rating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!applications.length && <p className="table-empty">Hali ariza bermagan.</p>}
          </>
        ) : (
          <>
            <h3 className="detail-h3">Smenalari ({shifts.length})</h3>
            <table className="admin-table">
              <thead><tr><th>Lavozim</th><th>Sana</th><th className="num">Haq</th><th className="num">Joy</th><th className="num">Kutmoqda</th><th className="num">Keldi</th></tr></thead>
              <tbody>
                {shifts.map((x) => (
                  <tr key={x.id}>
                    <td><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'shift', id: x.id })}>{x.title}</button><small>{x.place}</small></td>
                    <td>{day(x.date, false)}, {x.start_time}–{x.end_time}</td>
                    <td className="num">{som(x.pay)}</td>
                    <td className="num">{x.taken}/{x.slots}</td>
                    <td className="num">{x.pending}</td>
                    <td className="num">{x.came}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shifts.length && <p className="table-empty">Hali smena e’lon qilmagan.</p>}
          </>
        )}
      </>
    );
  } else if (card && 'shift' in card) {
    const { shift: s, applicants } = card;
    content = (
      <>
        <h2 id="detail-title">{s.title}</h2>
        <p className="muted">Smena #{s.id}</p>
        <dl className="kv-list">
          <Row k="Biznes"><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'user', id: s.org_id })}>{s.org}</button>, <Tel phone={s.org_phone} /></Row>
          <Row k="Sana va vaqt">{day(s.date)}, {s.start_time}–{s.end_time}</Row>
          <Row k="Manzil">{s.place}</Row>
          <Row k="Haq">{som(s.pay)}</Row>
          <Row k="Joylar">{s.taken}/{s.slots} band</Row>
          <Row k="Komissiya (kelganlar)">{som(Math.round(s.pay * 0.15 * applicants.filter((a) => a.status === 'came').length))}</Row>
          {s.note && <Row k="Izoh">{s.note}</Row>}
          <Row k="E’lon qilingan">{s.created_at}</Row>
        </dl>
        <h3 className="detail-h3">Arizachilar ({applicants.length})</h3>
        <table className="admin-table">
          <thead><tr><th>Ishchi</th><th>Telefon</th><th>Holat</th><th className="num">Baholar</th><th>Ariza vaqti</th></tr></thead>
          <tbody>
            {applicants.map((a) => (
              <tr key={a.id}>
                <td><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'user', id: a.worker_id })}>{a.name}</button>{a.blocked ? <small>Bloklangan</small> : null}</td>
                <td><Tel phone={a.phone} /></td>
                <td><span className={`chip chip-${a.status}`}>{STATUS[a.status]}</span></td>
                <td className="num">{stars(a.worker_rating)} / {stars(a.business_rating)}</td>
                <td>{a.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!applicants.length && <p className="table-empty">Hali ariza yo‘q.</p>}
      </>
    );
  }

  return (
    <div className="drawer-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* data-lenis-prevent: silliq scroll oynaning o'z ichidagi aylantirishini egallab olmasin */}
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title" data-lenis-prevent>
        <button type="button" className="drawer-close btn btn-ghost btn-sm" onClick={onClose}>Yopish</button>
        {error && <p className="banner danger">{error}</p>}
        {note && <p className="banner">{note}</p>}
        {content}
      </aside>
    </div>
  );
}
