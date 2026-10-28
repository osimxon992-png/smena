'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, day, som, STATUS, type Status } from '@/lib/client';
import Detail, { type Target } from './Detail';

type Stats = { workers: number; businesses: number; blocked: number; shifts: number; open_shifts: number; applications: number; pending: number; came: number; noshow: number; paid: number; commission: number };
type User = { id: number; role: 'worker' | 'business'; name: string; org: string | null; phone: string; blocked: number; created_at: string; rating: number | null; done: number; noshows: number; shifts: number };
type ShiftRow = { id: number; title: string; place: string; date: string; start_time: string; end_time: string; pay: number; slots: number; org: string; phone: string; taken: number; pending: number; came: number; noshow: number; is_open: number };
type AppRow = { id: number; shift_id: number; status: Status; worker_rating: number | null; business_rating: number | null; created_at: string; worker_id: number; worker: string; worker_phone: string; title: string; date: string; start_time: string; pay: number; org: string };
type Overview = { stats: Stats; users: User[]; shifts: ShiftRow[]; applications: AppRow[] };

const TABS = [['umumiy', 'Umumiy'], ['users', 'Foydalanuvchilar'], ['shifts', 'Smenalar'], ['apps', 'Arizalar']] as const;
type Tab = (typeof TABS)[number][0];
const REFRESH_MS = 30_000;

// Apostrof turlari farq qilmasin: "to'yxona" va "to‘yxona" bir xil topiladi
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[‘’ʻʼ'`]/g, '');
const matches = (q: string, ...fields: unknown[]) => !q || fields.some((f) => norm(f).includes(norm(q)));
const clock = (d: Date) => d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function Pick<T extends string>({ value, options, onPick, label }: { value: T; options: readonly (readonly [T, string])[]; onPick: (v: T) => void; label: string }) {
  return (
    <div className="pick-row" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} type="button" className="pick" aria-pressed={v === value} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('');
  return (
    <form className="form narrow" onSubmit={async (e) => {
      e.preventDefault();
      setError('');
      try { await api('/admin/login', { password: new FormData(e.currentTarget).get('password') }); onDone(); }
      catch (err) { setError((err as Error).message); }
    }}>
      <label className="field"><span>Admin paroli</span><input type="password" name="password" required autoComplete="current-password" /></label>
      <button className="btn btn-lg" type="submit">Kirish</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export default function AdminPanel() {
  const [access, setAccess] = useState<{ enabled: boolean; admin: boolean } | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('umumiy');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'worker' | 'business' | 'blocked'>('all');
  const [when, setWhen] = useState<'all' | 'open' | 'past'>('all');
  const [status, setStatus] = useState<'all' | Status>('all');
  const [detail, setDetail] = useState<Target | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const load = useCallback(async () => {
    try {
      setData(await api<Overview>('/admin/overview'));
      setUpdated(new Date());
      setError('');
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error).message.includes('kiring')) setAccess((a) => a && { ...a, admin: false });
    }
  }, []);

  const check = useCallback(() => api<{ enabled: boolean; admin: boolean }>('/admin/me').then(setAccess).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { check(); }, [check]);

  // Panel ochiq turganda har 30 soniyada o'zi yangilanadi; yashirin varaqda so'rov yubormaydi
  useEffect(() => {
    if (!access?.admin) return;
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [access?.admin, load]);

  async function setBlocked(u: User, blocked: boolean) {
    if (blocked && !confirm(`${u.name} bloklansinmi? U yangi smenalarga ariza bera olmaydi.`)) return;
    try { await api(`/admin/users/${u.id}`, { blocked }); await load(); } catch (e) { setError((e as Error).message); }
  }

  async function logout() {
    await api('/admin/logout', {}).catch(() => {});
    setData(null);
    setAccess((a) => a && { ...a, admin: false });
  }

  const head = (
    <header className="admin-top">
      <Link className="logo" href="/">Smena</Link>
      <span className="admin-badge">Admin</span>
      {access?.admin && (
        <>
          <nav className="admin-tabs" aria-label="Admin bo‘limlari">
            {TABS.map(([k, label]) => <button key={k} type="button" className="pick" aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
          </nav>
          <div className="admin-refresh">
            <span aria-live="polite">{updated ? `Yangilandi ${clock(updated)}` : 'Yuklanmoqda…'}</span>
            <button type="button" className="btn btn-ghost" onClick={load}>Yangilash</button>
            <button type="button" className="link" onClick={logout}>Chiqish</button>
          </div>
        </>
      )}
    </header>
  );

  if (!access) return <div className="admin"><div className="wrap">{head}{error && <p className="banner danger">{error}</p>}</div></div>;
  if (!access.enabled) {
    return (
      <div className="admin"><div className="wrap">{head}
        <div className="empty"><h2>Admin paneli yoqilmagan</h2><p>Serverda <code>ADMIN_PASSWORD</code> muhit o‘zgaruvchisini o‘rnating (lokalda <code>.env.local</code>, Vercel’da Settings → Environment Variables), keyin sahifani yangilang.</p></div>
      </div></div>
    );
  }
  if (!access.admin) return <div className="admin"><div className="wrap">{head}<h1>Admin paneliga kirish</h1><Login onDone={check} /></div></div>;

  const s = data?.stats;
  const users = (data?.users ?? []).filter((u) => (role === 'all' || (role === 'blocked' ? u.blocked : u.role === role)) && matches(q, u.name, u.org, u.phone));
  const shifts = (data?.shifts ?? []).filter((x) => (when === 'all' || (when === 'open') === !!x.is_open) && matches(q, x.title, x.org, x.place, x.phone));
  const apps = (data?.applications ?? []).filter((a) => (status === 'all' || a.status === status) && matches(q, a.worker, a.worker_phone, a.title, a.org));
  const search = <input className="search-input admin-search" type="search" placeholder="Ism, telefon, lavozim yoki biznes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />;

  return (
    <div className="admin">
      <div className="wrap">
        {head}
        {error && <p className="banner danger">{error}</p>}
        {!data ? <p className="lead">Ma’lumotlar yuklanmoqda…</p> : (
          <main id="asosiy">
            {tab === 'umumiy' && s && (
              <>
                <h1>Umumiy holat</h1>
                <div className="stat-grid">
                  <div className="stat"><strong>{s.workers}</strong><span>Ishchilar</span></div>
                  <div className="stat"><strong>{s.businesses}</strong><span>Bizneslar</span></div>
                  <div className="stat"><strong>{s.open_shifts}</strong><span>Ochiq smenalar ({s.shifts} jami)</span></div>
                  <div className="stat"><strong>{s.pending}</strong><span>Javob kutayotgan arizalar</span></div>
                  <div className="stat"><strong>{s.came}</strong><span>Bajarilgan smenalar</span></div>
                  <div className={`stat${s.noshow ? ' alert' : ''}`}><strong>{s.noshow}</strong><span>Kelmaganlar</span></div>
                  <div className={`stat${s.blocked ? ' alert' : ''}`}><strong>{s.blocked}</strong><span>Bloklanganlar</span></div>
                  <div className="stat money"><strong>{som(s.commission)}</strong><span>Komissiya, 15% ({som(s.paid)} ish haqidan)</span></div>
                </div>
                <h2 className="admin-h2">Oxirgi arizalar</h2>
                <AppsTable rows={data.applications.slice(0, 8)} onOpen={setDetail} />
                <button type="button" className="link" onClick={() => setTab('apps')}>Barcha arizalar ({data.applications.length})</button>
              </>
            )}

            {tab === 'users' && (
              <>
                <h1>Foydalanuvchilar</h1>
                <div className="toolbar">
                  {search}
                  <Pick label="Turi" value={role} onPick={setRole} options={[['all', 'Hammasi'], ['worker', 'Ishchilar'], ['business', 'Bizneslar'], ['blocked', 'Bloklanganlar']]} />
                  <span className="count">{users.length} ta</span>
                </div>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Ism</th><th>Turi</th><th>Telefon</th><th className="num">Reyting</th><th className="num">Bajargan</th><th className="num">Kelmagan</th><th className="num">Smenalari</th><th>Qo‘shilgan</th><th>Holat</th></tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="num">{u.id}</td>
                          <td><button type="button" className="cell-link" onClick={() => setDetail({ kind: 'user', id: u.id })}>{u.name}</button>{u.org && <small>{u.org}</small>}</td>
                          <td>{u.role === 'worker' ? 'Ishchi' : 'Biznes'}</td>
                          <td><a href={`tel:${u.phone}`}>{u.phone}</a></td>
                          <td className="num">{u.rating ? `★ ${u.rating}` : '—'}</td>
                          <td className="num">{u.role === 'worker' ? u.done : '—'}</td>
                          <td className="num">{u.role === 'worker' ? u.noshows : '—'}</td>
                          <td className="num">{u.role === 'business' ? u.shifts : '—'}</td>
                          <td>{u.created_at.slice(0, 10)}</td>
                          <td>
                            {u.blocked
                              ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBlocked(u, false)}>Blokdan chiqarish</button>
                              : <button type="button" className="btn btn-danger btn-sm" onClick={() => setBlocked(u, true)}>Bloklash</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!users.length && <p className="table-empty">Bu filtr bo‘yicha foydalanuvchi yo‘q.</p>}
                </div>
              </>
            )}

            {tab === 'shifts' && (
              <>
                <h1>Smenalar</h1>
                <div className="toolbar">
                  {search}
                  <Pick label="Vaqti" value={when} onPick={setWhen} options={[['all', 'Hammasi'], ['open', 'Ochiq'], ['past', 'Boshlangan yoki o‘tgan']]} />
                  <span className="count">{shifts.length} ta</span>
                </div>
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Sana</th><th>Vaqt</th><th>Lavozim</th><th>Biznes</th><th>Manzil</th><th className="num">Haq</th><th className="num">Joy</th><th className="num">Kutmoqda</th><th className="num">Keldi</th><th className="num">Kelmadi</th><th>Holat</th></tr></thead>
                    <tbody>
                      {shifts.map((x) => (
                        <tr key={x.id}>
                          <td className="num">{x.id}</td>
                          <td>{day(x.date, false)}</td>
                          <td className="num">{x.start_time}–{x.end_time}</td>
                          <td><button type="button" className="cell-link" onClick={() => setDetail({ kind: 'shift', id: x.id })}>{x.title}</button></td>
                          <td>{x.org}<small><a href={`tel:${x.phone}`}>{x.phone}</a></small></td>
                          <td>{x.place}</td>
                          <td className="num">{som(x.pay)}</td>
                          <td className="num">{x.taken}/{x.slots}</td>
                          <td className="num">{x.pending}</td>
                          <td className="num">{x.came}</td>
                          <td className="num">{x.noshow}</td>
                          <td><span className={`chip${x.is_open ? ' chip-accepted' : ''}`}>{x.is_open ? 'Ochiq' : 'Yopilgan'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shifts.length && <p className="table-empty">Bu filtr bo‘yicha smena yo‘q.</p>}
                </div>
              </>
            )}

            {tab === 'apps' && (
              <>
                <h1>Arizalar</h1>
                <div className="toolbar">
                  {search}
                  <Pick label="Holati" value={status} onPick={setStatus} options={[['all', 'Hammasi'], ...(Object.entries(STATUS) as [Status, string][])]} />
                  <span className="count">{apps.length} ta</span>
                </div>
                <AppsTable rows={apps} onOpen={setDetail} />
              </>
            )}
          </main>
        )}
      </div>
      {detail && <Detail target={detail} onOpen={setDetail} onClose={closeDetail} onChanged={load} />}
    </div>
  );
}

function AppsTable({ rows, onOpen }: { rows: AppRow[]; onOpen: (t: Target) => void }) {
  return (
    <div className="table-wrap">
      <table className="admin-table">
        <thead><tr><th>#</th><th>Ishchi</th><th>Smena</th><th>Biznes</th><th>Sana</th><th className="num">Haq</th><th>Holat</th><th className="num">Ishchiga baho</th><th className="num">Biznesga baho</th></tr></thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="num">{a.id}</td>
              <td><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'user', id: a.worker_id })}>{a.worker}</button><small><a href={`tel:${a.worker_phone}`}>{a.worker_phone}</a></small></td>
              <td><button type="button" className="cell-link" onClick={() => onOpen({ kind: 'shift', id: a.shift_id })}>{a.title}</button></td>
              <td>{a.org}</td>
              <td>{day(a.date, false)}, {a.start_time}</td>
              <td className="num">{som(a.pay)}</td>
              <td><span className={`chip chip-${a.status}`}>{STATUS[a.status]}</span></td>
              <td className="num">{a.worker_rating ? `★ ${a.worker_rating}` : '—'}</td>
              <td className="num">{a.business_rating ? `★ ${a.business_rating}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="table-empty">Hali ariza yo‘q.</p>}
    </div>
  );
}
