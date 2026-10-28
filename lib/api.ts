// Smena backend: SQLite (node:sqlite) va barcha API amallari. HTTP'dan mustaqil, shuning uchun test.ts uni to'g'ridan-to'g'ri chaqiradi.
import crypto from 'node:crypto';
import path from 'node:path';

// getBuiltinModule bundler'ni chetlab o'tadi: Next node:sqlite'ni o'zi yig'ishga urinmaydi
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

type Row = Record<string, any>;
type User = Row & { id: number; role: 'worker' | 'business'; blocked: number };
type Ctx = { user: User | undefined; body: Row; id: number; cookieHeader: string; https: boolean; cookie?: string };

const db = new DatabaseSync(process.env.DB || path.join(process.cwd(), 'smena.db'));
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('worker', 'business')),
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    org TEXT,
    pass TEXT NOT NULL,
    blocked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    place TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    pay INTEGER NOT NULL,
    slots INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY,
    shift_id INTEGER NOT NULL REFERENCES shifts(id),
    worker_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'accepted', 'rejected', 'came', 'noshow')),
    worker_rating INTEGER,
    business_rating INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (shift_id, worker_id)
  );
`);

const one = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as Row | undefined;
const all = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as Row[];
const run = (sql: string, ...p: any[]) => db.prepare(sql).run(...p);

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
// function e'loni (const emas): TypeScript faqat shunda chaqiruvdan keyingi kodni yetib bo'lmaydi deb biladi
function fail(status: number, message: string): never { throw new HttpError(status, message); }

// Smenalar Toshkent vaqtida; server istalgan vaqt zonasida ishlashi mumkin
function now() {
  const d = new Date();
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }),
    time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  };
}

// Smena boshlanguncha ochiq
const OPEN = '(s.date > ? OR (s.date = ? AND s.start_time > ?))';
const openArgs = () => { const { date, time } = now(); return [date, date, time]; };
const TAKEN = "(SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status IN ('accepted', 'came', 'noshow'))";
const ORG_RATING = '(SELECT ROUND(AVG(x.business_rating), 1) FROM applications x JOIN shifts y ON y.id = x.shift_id WHERE y.business_id = s.business_id)';

// --- Tekshiruvlar (trust boundary) ---

function str(v: unknown, min: number, max: number, label: string) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min || s.length > max) fail(400, `${label}: ${min}–${max} belgi bo‘lishi kerak`);
  return s;
}

function int(v: unknown, min: number, max: number, label: string) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isInteger(n) || n < min || n > max) fail(400, `${label}: ${min} dan ${max} gacha butun son kiriting`);
  return n;
}

function phone(v: unknown) {
  const digits = String(v ?? '').replace(/\D/g, '');
  const full = digits.length === 9 ? '998' + digits : digits;
  if (!/^998\d{9}$/.test(full)) fail(400, 'Telefon raqamni +998 90 123 45 67 ko‘rinishida kiriting');
  return '+' + full;
}

function date(v: unknown) {
  const s = String(v ?? '');
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(+d) || d.toISOString().slice(0, 10) !== s) fail(400, 'Sanani tanlang');
  return s;
}

const time = (v: unknown, label: string) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fail(400, `${label}ni kiriting`));

// --- Hisob va sessiya ---

function hash(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
}

function verify(password: string, stored: string) {
  return crypto.timingSafeEqual(Buffer.from(hash(password, stored.split(':')[0])), Buffer.from(stored));
}

const sessionToken = (cookieHeader: string) => /(?:^|;\s*)sid=([^;]+)/.exec(cookieHeader)?.[1];

function currentUser(cookieHeader: string) {
  const token = sessionToken(cookieHeader);
  if (!token) return undefined;
  return one(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at > datetime('now', '-30 days')",
    token,
  ) as User | undefined;
}

function need(user: User | undefined, role?: User['role']): asserts user is User {
  if (!user) fail(401, 'Avval hisobingizga kiring');
  if (role && user!.role !== role) fail(403, role === 'worker' ? 'Bu amal faqat ishchilar uchun' : 'Bu amal faqat bizneslar uchun');
}

function profile(u: Row) {
  const stats = u.role === 'worker'
    ? one("SELECT ROUND(AVG(worker_rating), 1) rating, COUNT(*) FILTER (WHERE status = 'came') done FROM applications WHERE worker_id = ?", u.id)
    : one('SELECT ROUND(AVG(a.business_rating), 1) rating FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE s.business_id = ?', u.id);
  return { id: u.id, role: u.role, name: u.name, org: u.org, phone: u.phone, blocked: !!u.blocked, ...stats };
}

function startSession(ctx: Ctx, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', token, userId);
  ctx.cookie = `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${ctx.https ? '; Secure' : ''}`;
  return profile(one('SELECT * FROM users WHERE id = ?', userId)!);
}

function register(ctx: Ctx) {
  const { body } = ctx;
  const role = ['worker', 'business'].includes(body.role) ? body.role : fail(400, 'Kimligingizni tanlang');
  const name = str(body.name, 2, 60, 'Ism');
  const org = role === 'business' ? str(body.org, 2, 80, 'Biznes nomi') : null;
  const p = phone(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 6 || password.length > 100) fail(400, 'Parol kamida 6 belgidan iborat bo‘lsin');
  if (one('SELECT 1 FROM users WHERE phone = ?', p)) fail(409, 'Bu raqam bilan ro‘yxatdan o‘tilgan. Kirish sahifasidan kiring');
  const { lastInsertRowid } = run('INSERT INTO users (role, phone, name, org, pass) VALUES (?, ?, ?, ?, ?)', role, p, name, org, hash(password));
  return startSession(ctx, Number(lastInsertRowid));
}

// shortcut: login urinishlari cheklanmagan; ommaga chiqarishdan oldin IP bo'yicha limit qo'ying
function login(ctx: Ctx) {
  const u = one('SELECT * FROM users WHERE phone = ?', phone(ctx.body.phone));
  if (!u || !verify(String(ctx.body.password ?? ''), u.pass)) fail(401, 'Telefon raqam yoki parol noto‘g‘ri');
  return startSession(ctx, u!.id);
}

function logout(ctx: Ctx) {
  const token = sessionToken(ctx.cookieHeader);
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  ctx.cookie = 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
  return { ok: true };
}

// --- Smenalar ---

// shortcut: birinchi 200 ta ochiq smena, sahifalash yo'q; ro'yxat o'sganda tuman/sana filtri qo'shing
function listShifts({ user }: Ctx) {
  return all(
    `SELECT s.*, u.org, ${ORG_RATING} org_rating, ${TAKEN} taken,
       (SELECT status FROM applications x WHERE x.shift_id = s.id AND x.worker_id = ?) my_status
     FROM shifts s JOIN users u ON u.id = s.business_id
     WHERE ${OPEN} ORDER BY s.date, s.start_time LIMIT 200`,
    user?.id ?? 0, ...openArgs(),
  );
}

function createShift({ user, body }: Ctx) {
  need(user, 'business');
  const d = date(body.date);
  if (d < now().date) fail(400, 'O‘tgan sanaga smena e’lon qilib bo‘lmaydi');
  const { lastInsertRowid } = run(
    'INSERT INTO shifts (business_id, title, place, date, start_time, end_time, pay, slots, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    user.id,
    str(body.title, 2, 80, 'Lavozim'),
    str(body.place, 2, 120, 'Manzil'),
    d,
    time(body.start, 'Boshlanish vaqti'),
    time(body.end, 'Tugash vaqti'),
    int(body.pay, 10000, 5000000, 'Haq'),
    int(body.slots, 1, 50, 'Odam soni'),
    typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '',
  );
  return { id: Number(lastInsertRowid) };
}

function shiftDetail({ user, id }: Ctx) {
  need(user, 'business');
  const shift = one(`SELECT s.*, u.org, ${TAKEN} taken FROM shifts s JOIN users u ON u.id = s.business_id WHERE s.id = ? AND s.business_id = ?`, id, user.id)
    || fail(404, 'Smena topilmadi');
  // Telefon raqam faqat qabul qilingandan keyin ochiladi
  const applicants = all(
    `SELECT a.id, a.status, a.worker_rating, u.name, u.blocked,
       CASE WHEN a.status IN ('accepted', 'came', 'noshow') THEN u.phone END phone,
       (SELECT ROUND(AVG(worker_rating), 1) FROM applications WHERE worker_id = u.id) rating,
       (SELECT COUNT(*) FROM applications WHERE worker_id = u.id AND status = 'came') done
     FROM applications a JOIN users u ON u.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.id`,
    id,
  );
  return { shift, applicants };
}

function myShifts({ user }: Ctx) {
  need(user, 'business');
  return all(
    `SELECT s.*, u.org, ${TAKEN} taken,
       (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'pending') pending
     FROM shifts s JOIN users u ON u.id = s.business_id
     WHERE s.business_id = ? ORDER BY s.date DESC, s.start_time DESC`,
    user.id,
  );
}

// --- Arizalar ---

function apply({ user, id }: Ctx) {
  need(user, 'worker');
  if (user.blocked) fail(403, 'Qabul qilingan smenaga kelmaganingiz uchun ariza bera olmaysiz');
  const s = one(`SELECT s.*, ${TAKEN} taken FROM shifts s WHERE s.id = ? AND ${OPEN}`, id, ...openArgs())
    || fail(404, 'Smena topilmadi yoki boshlanib bo‘lgan');
  if (s.taken >= s.slots) fail(409, 'Smenada bo‘sh joy qolmadi');
  if (one('SELECT 1 FROM applications WHERE shift_id = ? AND worker_id = ?', id, user.id)) fail(409, 'Bu smenaga ariza bergansiz');
  run('INSERT INTO applications (shift_id, worker_id) VALUES (?, ?)', id, user.id);
  return { ok: true };
}

function myApplications({ user }: Ctx) {
  need(user, 'worker');
  return all(
    `SELECT a.id, a.status, a.business_rating, s.title, s.place, s.date, s.start_time, s.end_time, s.pay, s.note, u.org,
       CASE WHEN a.status IN ('accepted', 'came', 'noshow') THEN u.phone END phone
     FROM applications a JOIN shifts s ON s.id = a.shift_id JOIN users u ON u.id = s.business_id
     WHERE a.worker_id = ? ORDER BY s.date DESC, s.start_time DESC`,
    user.id,
  );
}

// Biznes arizaga javob beradi yoki smenadan keyin kelgan-kelmaganini belgilaydi
function decide({ user, id, body }: Ctx) {
  need(user, 'business');
  const a = one('SELECT a.*, s.slots, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND s.business_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
  const { action } = body;
  if (action === 'accept' || action === 'reject') {
    if (a.status !== 'pending') fail(409, 'Bu arizaga javob berilgan');
    if (action === 'accept') {
      const { n } = one("SELECT COUNT(*) n FROM applications WHERE shift_id = ? AND status IN ('accepted', 'came', 'noshow')", a.shift_id)!;
      if (n >= a.slots) fail(409, 'Smenada bo‘sh joy qolmadi');
    }
    run('UPDATE applications SET status = ? WHERE id = ?', action === 'accept' ? 'accepted' : 'rejected', id);
  } else if (action === 'came' || action === 'noshow') {
    if (a.status !== 'accepted') fail(409, 'Faqat qabul qilingan ishchini belgilash mumkin');
    if (a.date > now().date) fail(409, 'Kelgan-kelmaganini smena kuni belgilaysiz');
    const rating = action === 'came' ? int(body.rating, 1, 5, 'Baho') : null;
    run('UPDATE applications SET status = ?, worker_rating = ? WHERE id = ?', action, rating, id);
    if (action === 'noshow') run('UPDATE users SET blocked = 1 WHERE id = ?', a.worker_id);
  } else {
    fail(400, 'Noma’lum amal');
  }
  return { ok: true };
}

function workerApplication(user: User | undefined, id: number) {
  need(user, 'worker');
  return one('SELECT a.*, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND a.worker_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
}

function rate({ user, id, body }: Ctx) {
  const a = workerApplication(user, id);
  if (a.status !== 'came' || a.business_rating) fail(409, 'Bu smenani baholab bo‘lmaydi');
  run('UPDATE applications SET business_rating = ? WHERE id = ?', int(body.rating, 1, 5, 'Baho'), id);
  return { ok: true };
}

function cancel({ user, id }: Ctx) {
  const a = workerApplication(user, id);
  // Smena kuni bekor qilish biznesni odamsiz qoldiradi; u holat "kelmadi" hisoblanadi
  if (!(a.status === 'pending' || (a.status === 'accepted' && a.date > now().date))) {
    fail(409, 'Qabul qilingan smenani kamida bir kun oldin bekor qilish mumkin');
  }
  run('DELETE FROM applications WHERE id = ?', id);
  return { ok: true };
}

const routes: [string, RegExp, (ctx: Ctx) => unknown][] = [
  ['POST', /^\/api\/register$/, register],
  ['POST', /^\/api\/login$/, login],
  ['POST', /^\/api\/logout$/, logout],
  ['GET', /^\/api\/me$/, ({ user }) => user && profile(user)],
  ['GET', /^\/api\/shifts$/, listShifts],
  ['POST', /^\/api\/shifts$/, createShift],
  ['GET', /^\/api\/shifts\/(\d+)$/, shiftDetail],
  ['POST', /^\/api\/shifts\/(\d+)\/apply$/, apply],
  ['GET', /^\/api\/my\/shifts$/, myShifts],
  ['GET', /^\/api\/my\/applications$/, myApplications],
  ['POST', /^\/api\/applications\/(\d+)$/, decide],
  ['POST', /^\/api\/applications\/(\d+)\/rate$/, rate],
  ['POST', /^\/api\/applications\/(\d+)\/cancel$/, cancel],
];

export type ApiRequest = { method: string; path: string; cookie: string | null; contentType: string | null; body: string; https: boolean };
export type ApiResponse = { status: number; data: unknown; cookie?: string };

export function handle(req: ApiRequest): ApiResponse {
  const ctx: Ctx = { user: currentUser(req.cookie ?? ''), body: {}, id: 0, cookieHeader: req.cookie ?? '', https: req.https };
  try {
    const route = routes.find(([method, re]) => method === req.method && re.test(req.path)) || fail(404, 'Topilmadi');
    ctx.id = Number(route[1].exec(req.path)![1]);
    if (req.method === 'POST') {
      // JSON talabi boshqa saytlardan forma orqali so'rov yuborishni (CSRF) to'sadi
      if (!String(req.contentType).startsWith('application/json')) fail(415, 'JSON kerak');
      if (req.body.length > 10_000) fail(413, 'So‘rov juda katta');
      let parsed: unknown = {};
      try { parsed = req.body ? JSON.parse(req.body) : {}; } catch { fail(400, 'Noto‘g‘ri so‘rov'); }
      ctx.body = parsed && typeof parsed === 'object' ? (parsed as Row) : {};
    }
    return { status: 200, data: route[2](ctx) ?? null, cookie: ctx.cookie };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, data: { error: err.message }, cookie: ctx.cookie };
    console.error(err);
    return { status: 500, data: { error: 'Serverda xatolik. Birozdan keyin qayta urinib ko‘ring' }, cookie: ctx.cookie };
  }
}
