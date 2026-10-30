// Smena backend: Turso (libSQL) bazasi va barcha API amallari. HTTP'dan mustaqil, shuning uchun test.ts uni to'g'ridan-to'g'ri chaqiradi.
// Vercel'da bir nechta nusxa bir vaqtda ishlaydi: "tekshir-keyin-yoz" o'rniga shartli UPDATE/DELETE ishlatiladi.
import crypto from 'node:crypto';
import { createClient, type InStatement, type ResultSet } from '@libsql/client';
import { MIN_AGE, ORG_TYPES, REGIONS, SKILLS } from './options.ts';

type Row = Record<string, any>;
type User = Row & { id: number; role: 'worker' | 'business'; blocked: number };
// JSON o'rniga qaytariladigan fayl (hozircha faqat profil rasmi)
type FileOut = { type: string; body: ArrayBuffer };
type Ctx = { user: User | undefined; body: Row; id: number; cookieHeader: string; https: boolean; ip: string; cookie?: string; file?: FileOut };

// Lokalda smena.db fayli, Vercel'da TURSO_DATABASE_URL (libsql://...) va TURSO_AUTH_TOKEN
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:smena.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const ready = db.executeMultiple(`
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
  CREATE TABLE IF NOT EXISTS login_fails (
    key TEXT NOT NULL,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS login_fails_key ON login_fails (key, at);
  CREATE TABLE IF NOT EXISTS photos (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    data BLOB NOT NULL,
    updated_at TEXT NOT NULL
  );
`).then(async () => {
  // Keyin qo'shilgan ustunlar: firebase_uid (Google orqali kirganlar) va profil.
  // SQLite'da "ADD COLUMN IF NOT EXISTS" yo'q: ustun bor bo'lsa xatoni o'tkazib yuboramiz
  for (const col of ['firebase_uid', 'first_name', 'last_name', 'birth_date', 'gender', 'region', 'district', 'about', 'skills', 'org_type', 'address']) {
    await exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`).catch((e) => { if (!/duplicate column/i.test(String(e?.message))) throw e; });
  }
  await exec('CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid ON users (firebase_uid)');
});

// libSQL qatorlari massivga o'xshash obyekt: JSON uchun oddiy {ustun: qiymat} ga aylantiramiz
const plain = (rs: ResultSet) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])) as Row);
const exec = (sql: string, ...args: any[]) => db.execute({ sql, args });
const one = async (sql: string, ...args: any[]) => plain(await exec(sql, ...args))[0] as Row | undefined;
const all = async (sql: string, ...args: any[]) => plain(await exec(sql, ...args));
const isUnique = (e: unknown) => /UNIQUE constraint failed/i.test(String((e as Error)?.message));

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

async function currentUser(cookieHeader: string) {
  const token = sessionToken(cookieHeader);
  if (!token) return undefined;
  return await one(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at > datetime('now', '-30 days')",
    token,
  ) as User | undefined;
}

function need(user: User | undefined, role?: User['role']): asserts user is User {
  if (!user) fail(401, 'Avval hisobingizga kiring');
  if (role && user!.role !== role) fail(403, role === 'worker' ? 'Bu amal faqat ishchilar uchun' : 'Bu amal faqat bizneslar uchun');
}

// Toshkent bo'yicha bugungi sanaga ko'ra to'liq yosh
function age(birth: string | null | undefined) {
  if (!birth) return null;
  const today = now().date;
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) >= birth.slice(5) ? years : years - 1;
}

// Rasm manzili o'zgarish vaqti bilan: rasm almashsa brauzer keshdan eskisini olmaydi
const photoUrl = (userId: number, version: string) => `/api/photos/${userId}?v=${encodeURIComponent(version)}`;
const parseSkills = (s: unknown): string[] => { try { return JSON.parse(String(s || '[]')); } catch { return []; } };

// Profil to'liq bo'lmaguncha ishchi ariza bera olmaydi, biznes smena e'lon qila olmaydi.
// Ishchidan rasm ham talab qilinadi: biznes kimni qabul qilayotganini ko'rsin
function isComplete(u: Row, hasPhoto: boolean) {
  const common = u.first_name && u.last_name && u.region && u.district;
  return !!(common && (u.role === 'worker' ? u.birth_date && u.gender && hasPhoto : u.org && u.org_type && u.address));
}

async function needProfile(user: User) {
  const photo = await one('SELECT 1 FROM photos WHERE user_id = ?', user.id);
  if (!isComplete(user, !!photo)) fail(403, 'Avval profilingizni to‘ldiring');
}

async function profile(u: Row) {
  const [stats, photo] = await Promise.all([
    u.role === 'worker'
      ? one("SELECT ROUND(AVG(worker_rating), 1) rating, COUNT(*) FILTER (WHERE status = 'came') done FROM applications WHERE worker_id = ?", u.id)
      : one('SELECT ROUND(AVG(a.business_rating), 1) rating FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE s.business_id = ?', u.id),
    one('SELECT updated_at FROM photos WHERE user_id = ?', u.id),
  ]);
  return {
    id: u.id, role: u.role, name: u.name, org: u.org, phone: u.phone, blocked: !!u.blocked,
    first_name: u.first_name ?? null, last_name: u.last_name ?? null, birth_date: u.birth_date ?? null, age: age(u.birth_date),
    gender: u.gender ?? null, region: u.region ?? null, district: u.district ?? null, about: u.about ?? '', skills: parseSkills(u.skills),
    org_type: u.org_type ?? null, address: u.address ?? null,
    photo: photo ? photoUrl(u.id, photo.updated_at) : null,
    google: !!u.firebase_uid, complete: isComplete(u, !!photo),
    ...stats,
  };
}

async function updateProfile({ user, body }: Ctx) {
  need(user);
  const first = str(body.first_name, 2, 30, 'Ism');
  const last = str(body.last_name, 2, 30, 'Familiya');
  // Avval viloyat, keyin shu viloyatning tumani yoki shahri
  const region = Object.hasOwn(REGIONS, body.region) ? body.region as string : fail(400, 'Qaysi viloyatda yashashingizni tanlang');
  const district = REGIONS[region].includes(body.district) ? body.district : fail(400, 'Tuman yoki shaharni tanlang');
  const fields: Row = { first_name: first, last_name: last, name: `${first} ${last}`, region, district, about: typeof body.about === 'string' ? body.about.trim().slice(0, 500) : '' };
  if (user.role === 'worker') {
    if (!body.birth_date) fail(400, 'Tug‘ilgan sanangizni kiriting');
    fields.birth_date = date(body.birth_date);
    const years = age(fields.birth_date)!;
    if (years < MIN_AGE) fail(400, `Smenalarda ${MIN_AGE} yoshdan katta bo‘lganlar ishlay oladi`);
    if (years > 80) fail(400, 'Tug‘ilgan sanani tekshiring');
    fields.gender = ['m', 'f'].includes(body.gender) ? body.gender : fail(400, 'Jinsingizni tanlang');
    fields.skills = JSON.stringify(Array.isArray(body.skills) ? [...new Set(body.skills.filter((s: unknown) => SKILLS.includes(s as string)))] : []);
  } else {
    fields.org = str(body.org, 2, 80, 'Biznes nomi');
    fields.org_type = ORG_TYPES.includes(body.org_type) ? body.org_type : fail(400, 'Biznes turini tanlang');
    fields.address = str(body.address, 5, 160, 'Manzil');
  }
  await exec(`UPDATE users SET ${Object.keys(fields).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(fields), user.id);
  return profile((await one('SELECT * FROM users WHERE id = ?', user.id))!);
}

// Rasm brauzerda 320×320 JPEG qilib kichraytiriladi; server faqat JPEG ekanini va hajmini tekshiradi
async function setPhoto({ user, body }: Ctx) {
  need(user);
  const data = typeof body.data === 'string' ? Buffer.from(body.data, 'base64') : Buffer.alloc(0);
  if (data.length < 100 || data.length > 200_000 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) fail(400, 'Rasmni yuklab bo‘lmadi. Boshqa rasm tanlang');
  await exec(
    `INSERT INTO photos (user_id, data, updated_at) VALUES (?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))
     ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    user.id, data,
  );
  return profile(user);
}

// Rasmlarni faqat kirganlar (va admin) ko'radi
async function getPhoto(ctx: Ctx) {
  if (!ctx.user && !isAdmin(ctx.cookieHeader)) fail(401, 'Avval hisobingizga kiring');
  const p = await one('SELECT data FROM photos WHERE user_id = ?', ctx.id) || fail(404, 'Rasm yo‘q');
  ctx.file = { type: 'image/jpeg', body: p.data as ArrayBuffer };
}

async function changePassword(ctx: Ctx) {
  const { user, body } = ctx;
  need(user);
  if (user.firebase_uid) fail(409, 'Siz Google orqali kirasiz: parol kerak emas');
  const limits: [string, number][] = [[`ip:${ctx.ip}`, 20], [`phone:${user.phone}`, 10]];
  await checkLimits(limits);
  if (!verify(String(body.old_password ?? ''), user.pass)) {
    await recordFail(limits);
    fail(401, 'Joriy parol noto‘g‘ri');
  }
  const password = typeof body.new_password === 'string' ? body.new_password : '';
  if (password.length < 6 || password.length > 100) fail(400, 'Yangi parol kamida 6 belgidan iborat bo‘lsin');
  // Boshqa qurilmalardagi kirishlar yopiladi, shu qurilmada yangi sessiya ochiladi
  await db.batch([
    { sql: 'UPDATE users SET pass = ? WHERE id = ?', args: [hash(password), user.id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] },
  ], 'write');
  return startSession(ctx, user.id);
}

async function startSession(ctx: Ctx, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  await exec('INSERT INTO sessions (token, user_id) VALUES (?, ?)', token, userId);
  ctx.cookie = `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${ctx.https ? '; Secure' : ''}`;
  return profile((await one('SELECT * FROM users WHERE id = ?', userId))!);
}

// firebaseUid bo'lsa (Google orqali), parol so'ralmaydi
async function createUser(ctx: Ctx, firebaseUid: string | null = null) {
  const { body } = ctx;
  const role = ['worker', 'business'].includes(body.role) ? body.role : fail(400, 'Kimligingizni tanlang');
  const name = str(body.name, 2, 60, 'Ism');
  const org = role === 'business' ? str(body.org, 2, 80, 'Biznes nomi') : null;
  const p = phone(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!firebaseUid && (password.length < 6 || password.length > 100)) fail(400, 'Parol kamida 6 belgidan iborat bo‘lsin');
  const taken = 'Bu raqam bilan ro‘yxatdan o‘tilgan. Kirish sahifasidan kiring';
  if (await one('SELECT 1 FROM users WHERE phone = ?', p)) fail(409, taken);
  try {
    // Google hisobida parol yo'q: tasodifiy parol xeshi telefon+parol bilan kirishni yopiq tutadi
    const { lastInsertRowid } = await exec(
      'INSERT INTO users (role, phone, name, org, pass, firebase_uid) VALUES (?, ?, ?, ?, ?, ?)',
      role, p, name, org, hash(firebaseUid ? crypto.randomBytes(32).toString('hex') : password), firebaseUid,
    );
    return startSession(ctx, Number(lastInsertRowid));
  } catch (e) {
    if (isUnique(e)) fail(409, taken);
    throw e;
  }
}

const register = (ctx: Ctx) => createUser(ctx);

// --- Google orqali kirish (Firebase Auth) ---
// Brauzer Firebase'dan ID token oladi; server uni Google'ning ochiq kalitlari bilan o'zi tekshiradi (firebase-admin kerak emas).
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'smena-855fd';
// test.ts o'z kalitini data: manzil orqali beradi
const keysUrl = () => process.env.FIREBASE_KEYS_URL || 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keyCache: { keys: Row[]; at: number } = { keys: [], at: 0 };

async function googleKey(kid: string) {
  const find = () => keyCache.keys.find((k) => k.kid === kid);
  const age = Date.now() - keyCache.at;
  // Google kalitlarni vaqti-vaqti bilan almashtiradi: 6 soatda bir yangilaymiz, noma'lum kid kelsa daqiqasiga ko'pi bilan bir marta
  if (age > 6 * 3600_000 || (!find() && age > 60_000)) {
    const res = await fetch(keysUrl()).catch(() => null);
    if (!res?.ok) fail(502, 'Google bilan bog‘lanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring');
    keyCache = { keys: (await res!.json()).keys ?? [], at: Date.now() };
  }
  return find();
}

function badToken(): never { fail(401, 'Google orqali kirish tasdiqlanmadi. Qayta urinib ko‘ring'); }
const jwtPart = (s: string) => { try { return JSON.parse(Buffer.from(s, 'base64url').toString()) as Row; } catch { return null; } };

async function googleUser(idToken: unknown) {
  const [h, p, s, extra] = typeof idToken === 'string' ? idToken.split('.') : [];
  const header = h ? jwtPart(h) : null, claims = p ? jwtPart(p) : null;
  if (!s || extra !== undefined || header?.alg !== 'RS256' || typeof header.kid !== 'string' || !claims) badToken();
  const key = await googleKey(header.kid) || badToken();
  const signed = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: 'jwk' }), Buffer.from(s, 'base64url'));
  const t = Date.now() / 1000;
  if (!signed || claims.aud !== FIREBASE_PROJECT || claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT}`
    || !(claims.exp > t) || !(claims.iat < t + 300) || typeof claims.sub !== 'string' || !claims.sub
    || claims.firebase?.sign_in_provider !== 'google.com') badToken();
  return { uid: claims.sub as string, name: typeof claims.name === 'string' ? claims.name.slice(0, 60) : '' };
}

// Hisob bo'lsa kiradi. Birinchi marta bo'lsa {signup} qaytadi: brauzer rol, ism va telefonni so'rab, shu token bilan qayta yuboradi
// (telefon kerak: smenaga qabul qilingach biznes ishchiga shu raqam orqali bog'lanadi)
async function google(ctx: Ctx) {
  const g = await googleUser(ctx.body.idToken);
  const u = await one('SELECT id FROM users WHERE firebase_uid = ?', g.uid);
  if (u) return startSession(ctx, u.id);
  if (ctx.body.role === undefined) return { signup: { name: g.name } };
  return createUser(ctx, g.uid);
}

// Parol tanlashni cheklash: 15 daqiqada noto'g'ri urinishlar soni [kalit, ruxsat] dan oshsa, 429.
// Hisob bazada, xotirada emas: Vercel'ning hamma nusxalari bitta hisobni ko'radi.
const FAIL_WINDOW = "datetime('now', '-15 minutes')";

async function checkLimits(limits: [string, number][]) {
  for (const [key, max] of limits) {
    const r = await one(`SELECT COUNT(*) n FROM login_fails WHERE key = ? AND at > ${FAIL_WINDOW}`, key);
    if (Number(r?.n) >= max) fail(429, 'Juda ko‘p noto‘g‘ri urinish. 15 daqiqadan keyin qayta urinib ko‘ring');
  }
}

async function recordFail(limits: [string, number][]) {
  await db.batch([
    `DELETE FROM login_fails WHERE at <= ${FAIL_WINDOW}`,
    ...limits.map(([key]) => ({ sql: 'INSERT INTO login_fails (key) VALUES (?)', args: [key] })),
  ], 'write');
}

// IP bo'yicha 20 ta (bir manzildan ko'p raqam sinash), raqam bo'yicha 10 ta (ko'p manzildan bitta raqam)
async function login(ctx: Ctx) {
  const p = phone(ctx.body.phone);
  const limits: [string, number][] = [[`ip:${ctx.ip}`, 20], [`phone:${p}`, 10]];
  await checkLimits(limits);
  const u = await one('SELECT * FROM users WHERE phone = ?', p);
  if (!u || !verify(String(ctx.body.password ?? ''), u.pass)) {
    await recordFail(limits);
    fail(401, 'Telefon raqam yoki parol noto‘g‘ri');
  }
  await exec('DELETE FROM login_fails WHERE key = ?', `phone:${p}`);
  return startSession(ctx, u!.id);
}

async function logout(ctx: Ctx) {
  const token = sessionToken(ctx.cookieHeader);
  if (token) await exec('DELETE FROM sessions WHERE token = ?', token);
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

async function createShift({ user, body }: Ctx) {
  need(user, 'business');
  await needProfile(user);
  const d = date(body.date);
  if (d < now().date) fail(400, 'O‘tgan sanaga smena e’lon qilib bo‘lmaydi');
  const { lastInsertRowid } = await exec(
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

async function shiftDetail({ user, id }: Ctx) {
  need(user, 'business');
  const shift = await one(`SELECT s.*, u.org, ${TAKEN} taken FROM shifts s JOIN users u ON u.id = s.business_id WHERE s.id = ? AND s.business_id = ?`, id, user.id)
    || fail(404, 'Smena topilmadi');
  // Telefon raqam faqat qabul qilingandan keyin ochiladi; profil (rasm, yosh, tuman, ko'nikmalar) darhol ko'rinadi
  const applicants = await all(
    `SELECT a.id, a.status, a.worker_rating, u.id worker_id, u.name, u.blocked, u.birth_date, u.gender, u.region, u.district, u.skills, u.about,
       CASE WHEN a.status IN ('accepted', 'came', 'noshow') THEN u.phone END phone,
       (SELECT updated_at FROM photos WHERE user_id = u.id) photo_v,
       (SELECT ROUND(AVG(worker_rating), 1) FROM applications WHERE worker_id = u.id) rating,
       (SELECT COUNT(*) FROM applications WHERE worker_id = u.id AND status = 'came') done
     FROM applications a JOIN users u ON u.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.id`,
    id,
  );
  return {
    shift,
    applicants: applicants.map(({ worker_id, birth_date, photo_v, skills, ...a }) => ({
      ...a, age: age(birth_date), skills: parseSkills(skills), photo: photo_v ? photoUrl(worker_id, photo_v) : null,
    })),
  };
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

async function apply({ user, id }: Ctx) {
  need(user, 'worker');
  if (user.blocked) fail(403, 'Qabul qilingan smenaga kelmaganingiz uchun ariza bera olmaysiz');
  await needProfile(user);
  const s = await one(`SELECT s.*, ${TAKEN} taken FROM shifts s WHERE s.id = ? AND ${OPEN}`, id, ...openArgs())
    || fail(404, 'Smena topilmadi yoki boshlanib bo‘lgan');
  if (s.taken >= s.slots) fail(409, 'Smenada bo‘sh joy qolmadi');
  try {
    await exec('INSERT INTO applications (shift_id, worker_id) VALUES (?, ?)', id, user.id);
  } catch (e) {
    if (isUnique(e)) fail(409, 'Bu smenaga ariza bergansiz');
    throw e;
  }
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
async function decide({ user, id, body }: Ctx) {
  need(user, 'business');
  const a = await one('SELECT a.*, s.slots, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND s.business_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
  const { action } = body;
  if (action === 'accept' || action === 'reject') {
    if (a.status !== 'pending') fail(409, 'Bu arizaga javob berilgan');
    // Joy borligini tekshirish va qabul qilish bitta so'rovda: ikki biznes oynasi bir vaqtda bossa ham joydan oshmaydi
    const { rowsAffected } = action === 'accept'
      ? await exec(
        `UPDATE applications SET status = 'accepted' WHERE id = ? AND status = 'pending'
           AND (SELECT COUNT(*) FROM applications x WHERE x.shift_id = ? AND x.status IN ('accepted', 'came', 'noshow')) < ?`,
        id, a.shift_id, a.slots)
      : await exec("UPDATE applications SET status = 'rejected' WHERE id = ? AND status = 'pending'", id);
    if (!rowsAffected) {
      const fresh = await one('SELECT status FROM applications WHERE id = ?', id);
      fail(409, fresh?.status === 'pending' ? 'Smenada bo‘sh joy qolmadi' : 'Bu arizaga javob berilgan');
    }
  } else if (action === 'came' || action === 'noshow') {
    if (a.status !== 'accepted') fail(409, 'Faqat qabul qilingan ishchini belgilash mumkin');
    if (a.date > now().date) fail(409, 'Kelgan-kelmaganini smena kuni belgilaysiz');
    const rating = action === 'came' ? int(body.rating, 1, 5, 'Baho') : null;
    const steps: InStatement[] = [{ sql: "UPDATE applications SET status = ?, worker_rating = ? WHERE id = ? AND status = 'accepted'", args: [action, rating, id] }];
    if (action === 'noshow') steps.push({ sql: 'UPDATE users SET blocked = 1 WHERE id = ?', args: [a.worker_id] });
    const [marked] = await db.batch(steps, 'write');
    if (!marked.rowsAffected) fail(409, 'Bu ishchi allaqachon belgilangan');
  } else {
    fail(400, 'Noma’lum amal');
  }
  return { ok: true };
}

async function workerApplication(user: User | undefined, id: number) {
  need(user, 'worker');
  return await one('SELECT a.*, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND a.worker_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
}

async function rate({ user, id, body }: Ctx) {
  await workerApplication(user, id);
  const rating = int(body.rating, 1, 5, 'Baho');
  const { rowsAffected } = await exec("UPDATE applications SET business_rating = ? WHERE id = ? AND status = 'came' AND business_rating IS NULL", rating, id);
  if (!rowsAffected) fail(409, 'Bu smenani baholab bo‘lmaydi');
  return { ok: true };
}

async function cancel({ user, id }: Ctx) {
  await workerApplication(user, id);
  // Smena kuni bekor qilish biznesni odamsiz qoldiradi; u holat "kelmadi" hisoblanadi
  const { rowsAffected } = await exec(
    `DELETE FROM applications WHERE id = ? AND (status = 'pending'
       OR (status = 'accepted' AND (SELECT date FROM shifts WHERE id = applications.shift_id) > ?))`,
    id, now().date,
  );
  if (!rowsAffected) fail(409, 'Qabul qilingan smenani kamida bir kun oldin bekor qilish mumkin');
  return { ok: true };
}

// --- Admin paneli ---
// Kirish ADMIN_PASSWORD muhit o'zgaruvchisi bilan; sessiya imzolangan cookie (bazada saqlanmaydi).
// Parol almashtirilsa, barcha admin sessiyalari o'z-o'zidan bekor bo'ladi.

const ADMIN_TTL = 12 * 3600;
const adminSign = (exp: number) => crypto.createHmac('sha256', process.env.ADMIN_PASSWORD!).update(`smena-admin:${exp}`).digest('base64url');
const sameSecret = (a: string, b: string) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());

function isAdmin(cookieHeader: string) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = /(?:^|;\s*)adm=(\d+)\.([\w-]+)/.exec(cookieHeader);
  return !!m && Number(m[1]) > Date.now() / 1000 && sameSecret(m[2], adminSign(Number(m[1])));
}

function needAdmin(ctx: Ctx) {
  if (!isAdmin(ctx.cookieHeader)) fail(401, 'Admin sifatida kiring');
}

// IP bo'yicha 15 daqiqada 5 ta noto'g'ri urinish
async function adminLogin(ctx: Ctx) {
  const secret = process.env.ADMIN_PASSWORD || fail(503, 'Admin paneli yoqilmagan: serverda ADMIN_PASSWORD o‘rnatilmagan');
  const limits: [string, number][] = [[`admin:${ctx.ip}`, 5]];
  await checkLimits(limits);
  if (!sameSecret(String(ctx.body.password ?? ''), secret)) {
    await recordFail(limits);
    fail(401, 'Parol noto‘g‘ri');
  }
  await exec('DELETE FROM login_fails WHERE key = ?', limits[0][0]);
  const exp = Math.floor(Date.now() / 1000) + ADMIN_TTL;
  ctx.cookie = `adm=${exp}.${adminSign(exp)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ADMIN_TTL}${ctx.https ? '; Secure' : ''}`;
  return { ok: true };
}

function adminLogout(ctx: Ctx) {
  ctx.cookie = 'adm=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
  return { ok: true };
}

// Panel uchun hamma narsa bitta so'rovda: raqamlar va uchta ro'yxat
// shortcut: har ro'yxatdan oxirgi 500 tasi; ma'lumot ko'payganda sahifalash qo'shing
async function adminOverview(ctx: Ctx) {
  needAdmin(ctx);
  const [stats, users, shifts, applications, sessions] = await Promise.all([
    one(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'worker') workers,
         (SELECT COUNT(*) FROM users WHERE role = 'business') businesses,
         (SELECT COUNT(*) FROM users WHERE blocked = 1) blocked,
         (SELECT COUNT(*) FROM shifts) shifts,
         (SELECT COUNT(*) FROM shifts s WHERE ${OPEN}) open_shifts,
         (SELECT COUNT(*) FROM applications) applications,
         (SELECT COUNT(*) FROM applications WHERE status = 'pending') pending,
         (SELECT COUNT(*) FROM applications WHERE status = 'came') came,
         (SELECT COUNT(*) FROM applications WHERE status = 'noshow') noshow,
         (SELECT COALESCE(SUM(s.pay), 0) FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.status = 'came') paid`,
      ...openArgs(),
    ),
    all(
      `SELECT u.id, u.role, u.name, u.org, u.phone, u.blocked, u.created_at,
         CASE WHEN u.role = 'worker'
           THEN (SELECT ROUND(AVG(worker_rating), 1) FROM applications WHERE worker_id = u.id)
           ELSE (SELECT ROUND(AVG(a.business_rating), 1) FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE s.business_id = u.id) END rating,
         (SELECT COUNT(*) FROM applications WHERE worker_id = u.id AND status = 'came') done,
         (SELECT COUNT(*) FROM applications WHERE worker_id = u.id AND status = 'noshow') noshows,
         (SELECT COUNT(*) FROM shifts WHERE business_id = u.id) shifts
       FROM users u ORDER BY u.id DESC LIMIT 500`,
    ),
    all(
      `SELECT s.id, s.title, s.place, s.date, s.start_time, s.end_time, s.pay, s.slots, s.created_at, u.id org_id, u.org, u.phone,
         ${TAKEN} taken,
         (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'pending') pending,
         (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'came') came,
         (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'noshow') noshow,
         CASE WHEN ${OPEN} THEN 1 ELSE 0 END is_open
       FROM shifts s JOIN users u ON u.id = s.business_id ORDER BY s.date DESC, s.start_time DESC LIMIT 500`,
      ...openArgs(),
    ),
    all(
      `SELECT a.id, a.status, a.worker_rating, a.business_rating, a.created_at,
         w.id worker_id, w.name worker, w.phone worker_phone, s.id shift_id, s.title, s.date, s.start_time, s.pay, b.org
       FROM applications a JOIN users w ON w.id = a.worker_id JOIN shifts s ON s.id = a.shift_id JOIN users b ON b.id = s.business_id
       ORDER BY a.id DESC LIMIT 500`,
    ),
    // Kirishlar tarixi: tokenning o'zi hech qachon chiqarilmaydi
    all(
      `SELECT s.created_at, u.id user_id, u.name, u.role, u.org, u.phone,
         CASE WHEN s.created_at > datetime('now', '-30 days') THEN 1 ELSE 0 END active
       FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 200`,
    ),
  ]);
  return { stats: { ...stats, commission: Math.round(Number(stats?.paid ?? 0) * 0.15) }, users, shifts, applications, sessions };
}

// Bloklash va blokdan chiqarish (kelmagan ishchini qayta faollashtirish shu yerdan)
async function adminSetBlocked(ctx: Ctx) {
  needAdmin(ctx);
  if (typeof ctx.body.blocked !== 'boolean') fail(400, 'blocked: true yoki false bo‘lishi kerak');
  const { rowsAffected } = await exec('UPDATE users SET blocked = ? WHERE id = ?', ctx.body.blocked ? 1 : 0, ctx.id);
  if (!rowsAffected) fail(404, 'Foydalanuvchi topilmadi');
  return { ok: true };
}

// Bitta foydalanuvchi haqida hammasi: profil, arizalari yoki smenalari, kirish sessiyalari.
// Parol ko'rsatilmaydi: bazada faqat scrypt xeshi turadi, asl parolni hech kim (admin ham) bila olmaydi.
async function adminUser(ctx: Ctx) {
  needAdmin(ctx);
  const u = await one(
    `SELECT id, role, name, org, phone, blocked, created_at, first_name, last_name, birth_date, gender, region, district, about, skills, org_type, address, firebase_uid
     FROM users WHERE id = ?`, ctx.id) || fail(404, 'Foydalanuvchi topilmadi');
  const [stats, sessions, applications, shifts] = await Promise.all([
    profile(u),
    one("SELECT COUNT(*) active, MAX(created_at) last_login FROM sessions WHERE user_id = ? AND created_at > datetime('now', '-30 days')", ctx.id),
    all(
      `SELECT a.id, a.status, a.worker_rating, a.business_rating, a.created_at, s.id shift_id, s.title, s.date, s.start_time, s.end_time, s.pay, b.org, b.phone org_phone
       FROM applications a JOIN shifts s ON s.id = a.shift_id JOIN users b ON b.id = s.business_id
       WHERE a.worker_id = ? ORDER BY s.date DESC, s.start_time DESC`, ctx.id),
    all(
      `SELECT s.id, s.title, s.place, s.date, s.start_time, s.end_time, s.pay, s.slots, s.note, ${TAKEN} taken,
         (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'pending') pending,
         (SELECT COUNT(*) FROM applications x WHERE x.shift_id = s.id AND x.status = 'came') came
       FROM shifts s WHERE s.business_id = ? ORDER BY s.date DESC, s.start_time DESC`, ctx.id),
  ]);
  return { user: { ...u, ...stats }, sessions, applications, shifts };
}

// Bitta smena: barcha arizachilar telefoni bilan
async function adminShift(ctx: Ctx) {
  needAdmin(ctx);
  const shift = await one(`SELECT s.*, u.org, u.phone org_phone, u.id org_id, ${TAKEN} taken FROM shifts s JOIN users u ON u.id = s.business_id WHERE s.id = ?`, ctx.id)
    || fail(404, 'Smena topilmadi');
  const applicants = await all(
    `SELECT a.id, a.status, a.worker_rating, a.business_rating, a.created_at, u.id worker_id, u.name, u.phone, u.blocked
     FROM applications a JOIN users u ON u.id = a.worker_id WHERE a.shift_id = ? ORDER BY a.id`, ctx.id);
  return { shift, applicants };
}

// Parolni unutgan foydalanuvchi uchun: yangi vaqtinchalik parol bir marta ko'rsatiladi, eski kirishlar yopiladi
async function adminResetPassword(ctx: Ctx) {
  needAdmin(ctx);
  const password = crypto.randomBytes(6).toString('base64url');
  const [changed] = await db.batch([
    { sql: 'UPDATE users SET pass = ? WHERE id = ?', args: [hash(password), ctx.id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [ctx.id] },
  ], 'write');
  if (!changed.rowsAffected) fail(404, 'Foydalanuvchi topilmadi');
  return { password };
}

async function adminEndSessions(ctx: Ctx) {
  needAdmin(ctx);
  const { rowsAffected } = await exec('DELETE FROM sessions WHERE user_id = ?', ctx.id);
  return { ended: rowsAffected };
}

const routes: [string, RegExp, (ctx: Ctx) => unknown][] = [
  ['GET', /^\/api\/admin\/users\/(\d+)$/, adminUser],
  ['POST', /^\/api\/admin\/users\/(\d+)\/password$/, adminResetPassword],
  ['POST', /^\/api\/admin\/users\/(\d+)\/logout$/, adminEndSessions],
  ['GET', /^\/api\/admin\/shifts\/(\d+)$/, adminShift],
  ['POST', /^\/api\/admin\/login$/, adminLogin],
  ['POST', /^\/api\/admin\/logout$/, adminLogout],
  ['GET', /^\/api\/admin\/me$/, (ctx) => ({ enabled: !!process.env.ADMIN_PASSWORD, admin: isAdmin(ctx.cookieHeader) })],
  ['GET', /^\/api\/admin\/overview$/, adminOverview],
  ['POST', /^\/api\/admin\/users\/(\d+)$/, adminSetBlocked],
  ['POST', /^\/api\/register$/, register],
  ['POST', /^\/api\/login$/, login],
  ['POST', /^\/api\/google$/, google],
  ['POST', /^\/api\/logout$/, logout],
  ['GET', /^\/api\/me$/, ({ user }) => user && profile(user)],
  ['POST', /^\/api\/me\/profile$/, updateProfile],
  ['POST', /^\/api\/me\/photo$/, setPhoto],
  ['POST', /^\/api\/me\/password$/, changePassword],
  ['GET', /^\/api\/photos\/(\d+)$/, getPhoto],
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

export type ApiRequest = { method: string; path: string; cookie: string | null; contentType: string | null; body: string; https: boolean; ip?: string };
export type ApiResponse = { status: number; data: unknown; cookie?: string; file?: FileOut };

export async function handle(req: ApiRequest): Promise<ApiResponse> {
  const ctx: Ctx = { user: undefined, body: {}, id: 0, cookieHeader: req.cookie ?? '', https: req.https, ip: req.ip || 'unknown' };
  try {
    await ready;
    ctx.user = await currentUser(ctx.cookieHeader);
    const route = routes.find(([method, re]) => method === req.method && re.test(req.path)) || fail(404, 'Topilmadi');
    ctx.id = Number(route[1].exec(req.path)![1]);
    if (req.method === 'POST') {
      // JSON talabi boshqa saytlardan forma orqali so'rov yuborishni (CSRF) to'sadi
      if (!String(req.contentType).startsWith('application/json')) fail(415, 'JSON kerak');
      // Rasm (base64, ~270 KB gacha) uchun alohida chegara
      if (req.body.length > (route[2] === setPhoto ? 300_000 : 10_000)) fail(413, 'So‘rov juda katta');
      let parsed: unknown = {};
      try { parsed = req.body ? JSON.parse(req.body) : {}; } catch { fail(400, 'Noto‘g‘ri so‘rov'); }
      ctx.body = parsed && typeof parsed === 'object' ? (parsed as Row) : {};
    }
    return { status: 200, data: (await route[2](ctx)) ?? null, cookie: ctx.cookie, file: ctx.file };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, data: { error: err.message }, cookie: ctx.cookie };
    console.error(err);
    return { status: 500, data: { error: 'Serverda xatolik. Birozdan keyin qayta urinib ko‘ring' }, cookie: ctx.cookie };
  }
}
