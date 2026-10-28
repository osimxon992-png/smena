// Smena: bir kunlik smenalar platformasi. Faqat Node o'zi: node:http + node:sqlite.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const db = new DatabaseSync(process.env.DB || path.join(__dirname, 'smena.db'));
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

const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

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

function str(v, min, max, label) {
  v = typeof v === 'string' ? v.trim() : '';
  if (v.length < min || v.length > max) fail(400, `${label}: ${min}–${max} belgi bo‘lishi kerak`);
  return v;
}

function int(v, min, max, label) {
  const n = Number(v);
  if (v === '' || !Number.isInteger(n) || n < min || n > max) fail(400, `${label}: ${min} dan ${max} gacha butun son kiriting`);
  return n;
}

function phone(v) {
  const digits = String(v ?? '').replace(/\D/g, '');
  const full = digits.length === 9 ? '998' + digits : digits;
  if (!/^998\d{9}$/.test(full)) fail(400, 'Telefon raqamni +998 90 123 45 67 ko‘rinishida kiriting');
  return '+' + full;
}

function date(v) {
  const d = new Date(`${v}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(d) || d.toISOString().slice(0, 10) !== v) fail(400, 'Sanani tanlang');
  return v;
}

const time = (v, label) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fail(400, `${label}ni kiriting`));

// --- Hisob va sessiya ---

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
}

function verify(password, stored) {
  return crypto.timingSafeEqual(Buffer.from(hash(password, stored.split(':')[0])), Buffer.from(stored));
}

function currentUser(req) {
  const token = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  return token && one(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.created_at > datetime('now', '-30 days')",
    token,
  );
}

function need(user, role) {
  if (!user) fail(401, 'Avval hisobingizga kiring');
  if (role && user.role !== role) fail(403, role === 'worker' ? 'Bu amal faqat ishchilar uchun' : 'Bu amal faqat bizneslar uchun');
}

function profile(u) {
  const stats = u.role === 'worker'
    ? one("SELECT ROUND(AVG(worker_rating), 1) rating, COUNT(*) FILTER (WHERE status = 'came') done FROM applications WHERE worker_id = ?", u.id)
    : one('SELECT ROUND(AVG(a.business_rating), 1) rating FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE s.business_id = ?', u.id);
  return { id: u.id, role: u.role, name: u.name, org: u.org, phone: u.phone, blocked: !!u.blocked, ...stats };
}

function startSession(ctx, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', token, userId);
  ctx.cookie = `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${ctx.https ? '; Secure' : ''}`;
  return profile(one('SELECT * FROM users WHERE id = ?', userId));
}

function register(ctx) {
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
function login(ctx) {
  const u = one('SELECT * FROM users WHERE phone = ?', phone(ctx.body.phone));
  if (!u || !verify(String(ctx.body.password ?? ''), u.pass)) fail(401, 'Telefon raqam yoki parol noto‘g‘ri');
  return startSession(ctx, u.id);
}

function logout(ctx) {
  const token = /(?:^|;\s*)sid=([^;]+)/.exec(ctx.req.headers.cookie || '')?.[1];
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  ctx.cookie = 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
  return { ok: true };
}

// --- Smenalar ---

// shortcut: birinchi 200 ta ochiq smena, sahifalash yo'q; ro'yxat o'sganda tuman/sana filtri qo'shing
function listShifts({ user }) {
  return all(
    `SELECT s.*, u.org, ${ORG_RATING} org_rating, ${TAKEN} taken,
       (SELECT status FROM applications x WHERE x.shift_id = s.id AND x.worker_id = ?) my_status
     FROM shifts s JOIN users u ON u.id = s.business_id
     WHERE ${OPEN} ORDER BY s.date, s.start_time LIMIT 200`,
    user?.id ?? 0, ...openArgs(),
  );
}

function createShift({ user, body }) {
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

function shiftDetail({ user, id }) {
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

function myShifts({ user }) {
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

function apply({ user, id }) {
  need(user, 'worker');
  if (user.blocked) fail(403, 'Qabul qilingan smenaga kelmaganingiz uchun ariza bera olmaysiz');
  const s = one(`SELECT s.*, ${TAKEN} taken FROM shifts s WHERE s.id = ? AND ${OPEN}`, id, ...openArgs())
    || fail(404, 'Smena topilmadi yoki boshlanib bo‘lgan');
  if (s.taken >= s.slots) fail(409, 'Smenada bo‘sh joy qolmadi');
  if (one('SELECT 1 FROM applications WHERE shift_id = ? AND worker_id = ?', id, user.id)) fail(409, 'Bu smenaga ariza bergansiz');
  run('INSERT INTO applications (shift_id, worker_id) VALUES (?, ?)', id, user.id);
  return { ok: true };
}

function myApplications({ user }) {
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
function decide({ user, id, body }) {
  need(user, 'business');
  const a = one('SELECT a.*, s.slots, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND s.business_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
  const { action } = body;
  if (action === 'accept' || action === 'reject') {
    if (a.status !== 'pending') fail(409, 'Bu arizaga javob berilgan');
    if (action === 'accept') {
      const { n } = one("SELECT COUNT(*) n FROM applications WHERE shift_id = ? AND status IN ('accepted', 'came', 'noshow')", a.shift_id);
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

function workerApplication(user, id) {
  need(user, 'worker');
  return one('SELECT a.*, s.date FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.id = ? AND a.worker_id = ?', id, user.id)
    || fail(404, 'Ariza topilmadi');
}

function rate({ user, id, body }) {
  const a = workerApplication(user, id);
  if (a.status !== 'came' || a.business_rating) fail(409, 'Bu smenani baholab bo‘lmaydi');
  run('UPDATE applications SET business_rating = ? WHERE id = ?', int(body.rating, 1, 5, 'Baho'), id);
  return { ok: true };
}

function cancel({ user, id }) {
  const a = workerApplication(user, id);
  // Smena kuni bekor qilish biznesni odamsiz qoldiradi; u holat "kelmadi" hisoblanadi
  if (!(a.status === 'pending' || (a.status === 'accepted' && a.date > now().date))) {
    fail(409, 'Qabul qilingan smenani kamida bir kun oldin bekor qilish mumkin');
  }
  run('DELETE FROM applications WHERE id = ?', id);
  return { ok: true };
}

const routes = [
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 10_000) { reject(Object.assign(new Error('So‘rov juda katta'), { status: 413 })); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
        resolve(body && typeof body === 'object' ? body : {});
      } catch { reject(Object.assign(new Error('Noto‘g‘ri so‘rov'), { status: 400 })); }
    });
  });
}

function send(res, status, data, cookie) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(cookie && { 'Set-Cookie': cookie }),
  });
  res.end(JSON.stringify(data ?? null));
}

// Sahifalardagi umumiy bo'laklar: <!-- include header --> → public/partials/header.html
// shortcut: har so'rovda diskdan o'qiladi; trafik oshsa xotirada keshlang
const includePartials = (html) => html.replace(/<!-- include (\w+) -->/g, (_, name) => fs.readFileSync(path.join(PUBLIC, 'partials', `${name}.html`), 'utf8'));

function serveStatic(pathname, res) {
  let file = '';
  try { file = path.join(PUBLIC, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)); } catch {}
  if (!file.startsWith(PUBLIC + path.sep)) return res.writeHead(404).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Topilmadi');
    if (path.extname(file) === '.html') {
      try { data = includePartials(data.toString()); } catch (e) {
        console.error(e);
        return res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Sahifa bo‘lagi topilmadi');
      }
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    }).end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith('/api/')) return serveStatic(pathname, res);

  const ctx = { req, user: currentUser(req), body: {}, https: req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' };
  try {
    const route = routes.find(([method, re]) => method === req.method && re.test(pathname)) || fail(404, 'Topilmadi');
    ctx.id = Number(route[1].exec(pathname)[1]);
    if (req.method === 'POST') {
      // JSON talabi boshqa saytlardan forma orqali so'rov yuborishni (CSRF) to'sadi
      if (!String(req.headers['content-type']).startsWith('application/json')) fail(415, 'JSON kerak');
      ctx.body = await readJson(req);
    }
    send(res, 200, route[2](ctx), ctx.cookie);
  } catch (err) {
    if (!err.status) console.error(err);
    send(res, err.status || 500, { error: err.status ? err.message : 'Serverda xatolik. Birozdan keyin qayta urinib ko‘ring' }, ctx.cookie);
  }
});

module.exports = server;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`Smena: http://localhost:${port}`));
}
