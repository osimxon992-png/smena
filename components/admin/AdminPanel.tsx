'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, day, som, STATUS, tashkentDate, type Status } from '@/lib/client';
import Farbo from '@/components/Farbo';
import Detail, { type Target } from './Detail';

type Stats = { workers: number; businesses: number; blocked: number; pro: number; shifts: number; open_shifts: number; applications: number; pending: number; came: number; noshow: number; paid: number; commission: number };
type User = { id: number; role: 'worker' | 'business'; name: string; org: string | null; phone: string; blocked: number; created_at: string; plan: string | null; plan_until: string | null; rating: number | null; done: number; noshows: number; shifts: number };
type ShiftRow = { id: number; title: string; place: string; date: string; start_time: string; end_time: string; pay: number; slots: number; org_id: number; org: string; phone: string; taken: number; pending: number; came: number; noshow: number; is_open: number };
type AppRow = { id: number; shift_id: number; status: Status; worker_rating: number | null; business_rating: number | null; created_at: string; worker_id: number; worker: string; worker_phone: string; title: string; date: string; start_time: string; pay: number; org: string };
type Login = { created_at: string; user_id: number; name: string; role: 'worker' | 'business'; org: string | null; phone: string; active: number };
type Overview = { stats: Stats; users: User[]; shifts: ShiftRow[]; applications: AppRow[]; sessions: Login[] };
type Open = (t: Target) => void;

// Yon menyu: guruhlar va bo'limlar
const GROUPS = [
  ['Asosiy', [['umumiy', 'Umumiy holat'], ['bugun', 'Bugun']]],
  ['Foydalanuvchilar', [['ishchilar', 'Ishchilar'], ['bizneslar', 'Bizneslar'], ['obunachilar', 'Pro obunachilar'], ['bloklangan', 'Bloklanganlar']]],
  ['Smenalar', [['ochiq', 'Ochiq smenalar'], ['yopilgan', 'Yopilgan smenalar']]],
  ['Arizalar', [['yangi', 'Yangi arizalar'], ['qabul', 'Qabul qilinganlar'], ['bajarilgan', 'Bajarilganlar'], ['kelmagan', 'Kelmaganlar'], ['arizalar', 'Barcha arizalar']]],
  ['Hisobot', [['moliya', 'Moliya'], ['baholar', 'Baholar'], ['kirishlar', 'Kirishlar']]],
] as const;
type Tab = (typeof GROUPS)[number][1][number][0];
const TITLES = Object.fromEntries(GROUPS.flatMap(([, items]) => items as readonly (readonly [Tab, string])[])) as Record<Tab, string>;
const REFRESH_MS = 30_000;

// Apostrof turlari farq qilmasin: "to'yxona" va "to‘yxona" bir xil topiladi
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[‘’ʻʼ'`]/g, '');
const matches = (q: string, ...fields: unknown[]) => !q || fields.some((f) => norm(f).includes(norm(q)));
const clock = (d: Date) => d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const stars = (n: number | null) => (n ? `★ ${n}` : '—');
const Tel = ({ phone }: { phone: string }) => <a href={`tel:${phone}`}>{phone}</a>;
// Amaldagi Pro: muddati yo'q yoki hali tugamagan
const isPro = (u: { plan: string | null; plan_until: string | null }) => u.plan === 'pro' && (!u.plan_until || u.plan_until >= tashkentDate());
const Name = ({ text, onClick }: { text: string; onClick: () => void }) => <button type="button" className="cell-link" onClick={onClick}>{text}</button>;

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

function Table({ head, empty, children, count }: { head: React.ReactNode; empty: string; children: React.ReactNode[]; count?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="admin-table"><thead><tr>{head}</tr></thead><tbody>{children}</tbody></table>
      {!children.length && <p className="table-empty">{empty}</p>}
      {count !== false && children.length > 0 && <p className="table-count">{children.length} ta</p>}
    </div>
  );
}

function UsersTable({ rows, onOpen, onBlock }: { rows: User[]; onOpen: Open; onBlock: (u: User, blocked: boolean) => void }) {
  return (
    <Table empty="Bu bo‘limda foydalanuvchi yo‘q." head={<><th>#</th><th>Ism</th><th>Telefon</th><th className="num">Reyting</th><th className="num">Bajargan</th><th className="num">Kelmagan</th><th className="num">Smenalari</th><th>Obuna</th><th>Qo‘shilgan</th><th>Amal</th></>}>
      {rows.map((u) => (
        <tr key={u.id}>
          <td className="num">{u.id}</td>
          <td><Name text={u.name} onClick={() => onOpen({ kind: 'user', id: u.id })} />{u.org && <small>{u.org}</small>}</td>
          <td><Tel phone={u.phone} /></td>
          <td className="num">{stars(u.rating)}</td>
          <td className="num">{u.role === 'worker' ? u.done : '—'}</td>
          <td className="num">{u.role === 'worker' ? u.noshows : '—'}</td>
          <td className="num">{u.role === 'business' ? u.shifts : '—'}</td>
          <td>{isPro(u) ? <span className="chip chip-pro">Pro{u.plan_until ? ` · ${u.plan_until} gacha` : ''}</span> : <span className="muted">Bepul</span>}</td>
          <td>{u.created_at.slice(0, 10)}</td>
          <td>
            {u.blocked
              ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => onBlock(u, false)}>Blokdan chiqarish</button>
              : <button type="button" className="btn btn-danger btn-sm" onClick={() => onBlock(u, true)}>Bloklash</button>}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function ShiftsTable({ rows, onOpen }: { rows: ShiftRow[]; onOpen: Open }) {
  return (
    <Table empty="Bu bo‘limda smena yo‘q." head={<><th>#</th><th>Sana</th><th>Vaqt</th><th>Lavozim</th><th>Biznes</th><th>Manzil</th><th className="num">Haq</th><th className="num">Joy</th><th className="num">Kutmoqda</th><th className="num">Keldi</th><th className="num">Kelmadi</th></>}>
      {rows.map((x) => (
        <tr key={x.id}>
          <td className="num">{x.id}</td>
          <td>{day(x.date, false)}</td>
          <td className="num">{x.start_time}–{x.end_time}</td>
          <td><Name text={x.title} onClick={() => onOpen({ kind: 'shift', id: x.id })} /></td>
          <td><Name text={x.org} onClick={() => onOpen({ kind: 'user', id: x.org_id })} /><small><Tel phone={x.phone} /></small></td>
          <td>{x.place}</td>
          <td className="num">{som(x.pay)}</td>
          <td className="num">{x.taken}/{x.slots}</td>
          <td className="num">{x.pending}</td>
          <td className="num">{x.came}</td>
          <td className="num">{x.noshow}</td>
        </tr>
      ))}
    </Table>
  );
}

function AppsTable({ rows, onOpen, count }: { rows: AppRow[]; onOpen: Open; count?: boolean }) {
  return (
    <Table count={count} empty="Bu bo‘limda ariza yo‘q." head={<><th>#</th><th>Ishchi</th><th>Smena</th><th>Biznes</th><th>Sana</th><th className="num">Haq</th><th>Holat</th><th className="num">Ishchiga baho</th><th className="num">Biznesga baho</th></>}>
      {rows.map((a) => (
        <tr key={a.id}>
          <td className="num">{a.id}</td>
          <td><Name text={a.worker} onClick={() => onOpen({ kind: 'user', id: a.worker_id })} /><small><Tel phone={a.worker_phone} /></small></td>
          <td><Name text={a.title} onClick={() => onOpen({ kind: 'shift', id: a.shift_id })} /></td>
          <td>{a.org}</td>
          <td>{day(a.date, false)}, {a.start_time}</td>
          <td className="num">{som(a.pay)}</td>
          <td><span className={`chip chip-${a.status}`}>{STATUS[a.status]}</span></td>
          <td className="num">{stars(a.worker_rating)}</td>
          <td className="num">{stars(a.business_rating)}</td>
        </tr>
      ))}
    </Table>
  );
}

// Sayt bo'sh ko'rinmasin: namuna bizneslar va smenalarni bir tugma bilan qo'shish yoki o'chirish
function DemoControl({ count, onDone }: { count: number; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function run(action: 'add' | 'remove') {
    if (action === 'remove' && !confirm('Barcha demo bizneslar va smenalar o‘chiriladi. Davom etasizmi?')) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await api<{ added?: number; removed?: number }>('/admin/demo', { action });
      setMsg(action === 'add' ? `${r.added} ta demo smena qo‘shildi` : `${r.removed} ta demo smena o‘chirildi`);
      await onDone();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="demo-box">
      <div>
        <h2 className="admin-h2">Demo ishlar</h2>
        <p className="hint">4 ta namuna biznes va 12 ta smena (bugundan 5 kungacha). Nomida “(demo)” turadi, ularga ariza berib bo‘lmaydi. Hozir: {count} ta demo smena.</p>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={() => run('add')}>{count ? 'Demo ishlarni yangilash' : 'Demo ishlarni qo‘shish'}</button>
        {count > 0 && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run('remove')}>O‘chirish</button>}
      </div>
      {msg && <p className="demo-msg" role="status">{msg}</p>}
    </section>
  );
}

export default function AdminPanel() {
  const [access, setAccess] = useState<{ enabled: boolean; admin: boolean } | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('umumiy');
  const [q, setQ] = useState('');
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

  const today = tashkentDate();
  const s = data?.stats;
  const users = (data?.users ?? []).filter((u) => matches(q, u.name, u.org, u.phone));
  const shifts = (data?.shifts ?? []).filter((x) => matches(q, x.title, x.org, x.place, x.phone));
  const apps = (data?.applications ?? []).filter((a) => matches(q, a.worker, a.worker_phone, a.title, a.org));
  const logins = (data?.sessions ?? []).filter((l) => matches(q, l.name, l.org, l.phone));
  const byStatus = (st: Status) => apps.filter((a) => a.status === st);
  const rated = apps.filter((a) => a.worker_rating || a.business_rating);

  // Moliya: har bir biznes bo'yicha bajarilgan smenalar, ish haqi va 15% komissiya
  const finance = Object.values(shifts.reduce<Record<number, { id: number; org: string; phone: string; shifts: number; came: number; paid: number }>>((acc, x) => {
    const row = (acc[x.org_id] ??= { id: x.org_id, org: x.org, phone: x.phone, shifts: 0, came: 0, paid: 0 });
    row.shifts += 1;
    row.came += x.came;
    row.paid += x.came * x.pay;
    return acc;
  }, {})).sort((a, b) => b.paid - a.paid);

  const lists = {
    umumiy: null, moliya: finance, baholar: rated, kirishlar: logins,
    bugun: shifts.filter((x) => x.date === today),
    ishchilar: users.filter((u) => u.role === 'worker'),
    bizneslar: users.filter((u) => u.role === 'business'),
    bloklangan: users.filter((u) => u.blocked),
    obunachilar: users.filter(isPro),
    ochiq: shifts.filter((x) => x.is_open),
    yopilgan: shifts.filter((x) => !x.is_open),
    yangi: byStatus('pending'), qabul: byStatus('accepted'), bajarilgan: byStatus('came'), kelmagan: byStatus('noshow'),
    arizalar: apps,
  } satisfies Record<Tab, unknown[] | null>;
  // Diqqat talab qiladigan bo'limlar sonini qizil ko'rsatamiz
  const hot: Partial<Record<Tab, boolean>> = { yangi: true, kelmagan: true, bloklangan: true };

  const side = (
    <aside className="admin-side" data-lenis-prevent>
      <div className="side-brand"><Link className="logo" href="/">Smena</Link><span className="admin-badge">Admin</span></div>
      <nav className="side-nav" aria-label="Admin bo‘limlari">
        {GROUPS.map(([group, items]) => (
          <div key={group} className="side-group">
            <p className="side-group-title">{group}</p>
            {items.map(([k, label]) => {
              const n = lists[k]?.length;
              return (
                <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
                  <span>{label}</span>
                  {n != null && <small className={hot[k] && n ? 'hot' : ''}>{n}</small>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <span aria-live="polite">{updated ? `Yangilandi ${clock(updated)}` : 'Yuklanmoqda…'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load}>Yangilash</button>
        <Link className="side-link" href="/" target="_blank">Saytni ochish</Link>
        <button type="button" className="side-link" onClick={logout}>Chiqish</button>
      </div>
    </aside>
  );

  let view: React.ReactNode = null;
  if (data && s) {
    switch (tab) {
      case 'umumiy':
        view = (
          <>
            <div className="stat-grid">
              {([
                ['ishchilar', s.workers, 'Ishchilar'], ['bizneslar', s.businesses, 'Bizneslar'],
                ['ochiq', s.open_shifts, `Ochiq smenalar (${s.shifts} jami)`], ['yangi', s.pending, 'Javob kutayotgan arizalar'],
                ['bajarilgan', s.came, 'Bajarilgan smenalar'], ['kelmagan', s.noshow, 'Kelmaganlar'],
                ['bloklangan', s.blocked, 'Bloklanganlar'], ['obunachilar', s.pro, 'Pro obunachilar'],
              ] as [Tab, number, string][]).map(([k, n, label]) => (
                <button key={k} type="button" className={`stat${hot[k] && n ? ' alert' : ''}`} onClick={() => setTab(k)}><strong>{n}</strong><span>{label}</span></button>
              ))}
              <button type="button" className="stat money" onClick={() => setTab('moliya')}><strong>{som(s.commission)}</strong><span>Komissiya, 15% ({som(s.paid)} ish haqidan)</span></button>
            </div>
            <DemoControl count={data.shifts.filter((x) => x.org.endsWith('(demo)')).length} onDone={load} />
            <h2 className="admin-h2">Oxirgi arizalar</h2>
            <AppsTable rows={apps.slice(0, 8)} onOpen={setDetail} count={false} />
          </>
        );
        break;
      case 'bugun': view = <ShiftsTable rows={lists.bugun} onOpen={setDetail} />; break;
      case 'ishchilar': case 'bizneslar': case 'bloklangan': case 'obunachilar':
        view = <UsersTable rows={lists[tab]} onOpen={setDetail} onBlock={setBlocked} />; break;
      case 'ochiq': case 'yopilgan':
        view = <ShiftsTable rows={lists[tab]} onOpen={setDetail} />; break;
      case 'yangi': case 'qabul': case 'bajarilgan': case 'kelmagan': case 'arizalar': case 'baholar':
        view = <AppsTable rows={lists[tab]} onOpen={setDetail} />; break;
      case 'moliya':
        view = (
          <>
            <div className="stat-grid">
              <div className="stat money"><strong>{som(s.commission)}</strong><span>Jami komissiya, 15%</span></div>
              <div className="stat"><strong>{som(s.paid)}</strong><span>Ishchilarga to‘langan haq</span></div>
              <div className="stat"><strong>{s.came}</strong><span>Bajarilgan smenalar</span></div>
              <div className="stat"><strong>{som(s.came ? Math.round(s.paid / s.came) : 0)}</strong><span>O‘rtacha smena haqi</span></div>
            </div>
            <h2 className="admin-h2">Bizneslar bo‘yicha</h2>
            <Table empty="Hali bajarilgan smena yo‘q." head={<><th>Biznes</th><th>Telefon</th><th className="num">Smenalar</th><th className="num">Kelgan ishchilar</th><th className="num">Ish haqi</th><th className="num">Komissiya, 15%</th></>}>
              {finance.map((f) => (
                <tr key={f.id}>
                  <td><Name text={f.org} onClick={() => setDetail({ kind: 'user', id: f.id })} /></td>
                  <td><Tel phone={f.phone} /></td>
                  <td className="num">{f.shifts}</td>
                  <td className="num">{f.came}</td>
                  <td className="num">{som(f.paid)}</td>
                  <td className="num"><strong>{som(Math.round(f.paid * 0.15))}</strong></td>
                </tr>
              ))}
            </Table>
          </>
        );
        break;
      case 'kirishlar':
        view = (
          <Table empty="Hali kirishlar yo‘q." head={<><th>Vaqt</th><th>Kim</th><th>Turi</th><th>Telefon</th><th>Holat</th></>}>
            {logins.map((l, i) => (
              <tr key={`${l.user_id}-${l.created_at}-${i}`}>
                <td className="num">{l.created_at}</td>
                <td><Name text={l.name} onClick={() => setDetail({ kind: 'user', id: l.user_id })} />{l.org && <small>{l.org}</small>}</td>
                <td>{l.role === 'worker' ? 'Ishchi' : 'Biznes'}</td>
                <td><Tel phone={l.phone} /></td>
                <td>{l.active ? <span className="chip chip-accepted">Faol</span> : <span className="chip">Muddati o‘tgan</span>}</td>
              </tr>
            ))}
          </Table>
        );
        break;
    }
  }

  return (
    <div className="admin admin-shell">
      {side}
      <div className="admin-main">
        {error && <p className="banner danger">{error}</p>}
        <div className="admin-head">
          <h1>{TITLES[tab]}</h1>
          {tab !== 'umumiy' && <input className="search-input admin-search" type="search" placeholder="Ism, telefon, lavozim yoki biznes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />}
        </div>
        {!data ? <p className="lead">Ma’lumotlar yuklanmoqda…</p> : <main id="asosiy">{view}</main>}
      </div>
      <Farbo admin={{ onOpen: setDetail }} />
      {detail && <Detail target={detail} onOpen={setDetail} onClose={closeDetail} onChanged={load} />}
    </div>
  );
}
