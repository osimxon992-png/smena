// API o'z-o'zini tekshirish: node test.ts (vaqtinchalik xotiradagi libSQL bazasi bilan)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

process.env.TURSO_DATABASE_URL = ':memory:';
process.env.ADMIN_PASSWORD = 'test-admin-parol';
// Google tokenlarini sinov kaliti bilan imzolaymiz; server ochiq kalitni shu data: manzildan oladi
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.FIREBASE_KEYS_URL = 'data:application/json,' + encodeURIComponent(JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'sinov', alg: 'RS256' }] }));
// Baza manzili import paytida o'qiladi, shuning uchun api muhit o'rnatilgandan keyin yuklanadi
// Telegram'ni soxta server almashtiradi: bot yuborgan xabarlar tgSent ga yig'iladi
const tgSent: any[] = [];
let tgFail = false;
let tgHook = '';
const tgFake = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const method = req.url!.split('/').pop()!;
    const body = b ? JSON.parse(b) : {};
    tgSent.push({ method, ...body });
    if (method === 'setWebhook') tgHook = body.url;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(
      tgFail && method === 'sendMessage' ? { ok: false, description: 'Forbidden: bot was blocked by the user' }
        : method === 'getWebhookInfo' ? { ok: true, result: { url: tgHook } }
        : method === 'getMe' ? { ok: true, result: { username: 'smenauzbbot' } }
        : { ok: true, result: true },
    ));
  });
});
await new Promise<void>((r) => tgFake.listen(0, '127.0.0.1', () => r()));
process.env.TELEGRAM_API = `http://127.0.0.1:${(tgFake.address() as any).port}`;
process.env.TELEGRAM_BOT_TOKEN = '123:test';
const { handle } = await import('./lib/api.ts');

const jar: Record<string, string> = {};
async function call(who: string, path: string, body?: object, contentType = 'application/json') {
  const [pathname, query = ''] = path.split('?');
  const res = await handle({ method: body ? 'POST' : 'GET', path: '/api' + pathname, query, cookie: jar[who] ?? '', contentType, body: body ? JSON.stringify(body) : '', https: false });
  if (res.cookie) jar[who] = res.cookie.split(';')[0];
  return res as { status: number; data: any };
}
const status = async (who: string, path: string, body?: object) => (await call(who, path, body)).status;

// Firebase tokenlari (Google va SMS) sinov kaliti bilan imzolanadi
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function firebaseToken(claims: object, kid = 'sinov') {
  const t = Math.floor(Date.now() / 1000);
  const signed = `${b64({ alg: 'RS256', kid })}.${b64({ iss: 'https://securetoken.google.com/smena-855fd', aud: 'smena-855fd', iat: t, exp: t + 3600, auth_time: t, ...claims })}`;
  return `${signed}.${crypto.sign('RSA-SHA256', Buffer.from(signed), privateKey).toString('base64url')}`;
}
const googleToken = (uid: string, claims: object = {}, kid = 'sinov') =>
  firebaseToken({ sub: uid, name: 'Gulnora Karimova', firebase: { sign_in_provider: 'google.com' }, ...claims }, kid);
const e164 = (phone: string) => { const d = phone.replace(/\D/g, ''); return '+' + (d.length === 9 ? '998' + d : d); };

// Telegram bot: webhook'ga yangilanish yuborish, raqamni bog'lash va kelgan kodni olish
const TG_SECRET = crypto.createHash('sha256').update('smena-webhook:123:test').digest('hex').slice(0, 32);
const tg = (update: object, secret = TG_SECRET) =>
  handle({ method: 'POST', path: '/api/telegram/webhook', cookie: '', contentType: 'application/json', body: JSON.stringify(update), https: false, tgSecret: secret });
let chatSeq = 100;
async function linkTg(phone: string) {
  const id = ++chatSeq;
  await tg({ message: { chat: { id, type: 'private' }, from: { id }, contact: { phone_number: e164(phone).slice(1), user_id: id } } });
  return id;
}
const lastCode = () => /(\d{6})/.exec([...tgSent].reverse().find((m) => m.method === 'sendMessage' && /kodi/.test(m.text))?.text ?? '')?.[1] ?? '000000';
// Ro'yxat uchun: raqamni botga bog'lab, kod so'raydi va Telegram'ga kelgan kodni qo'shadi
async function withCode(body: any, google = false) {
  await linkTg(body.phone);
  const r = await call('kod', '/register/check', google ? { ...body, google: true } : body);
  return { ...body, code: r.status === 200 ? lastCode() : '000000' };
}

// Ariza berish va smena e'lon qilish uchun profil to'liq bo'lishi kerak (ishchida rasm ham)
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString('base64');
async function fill(who: string) {
  const me = (await call(who, '/me')).data;
  const body = me.role === 'worker'
    ? { first_name: me.name, last_name: 'Testov', region: 'Toshkent shahri', district: 'Chilonzor', birth_date: '2000-05-01', gender: 'f', skills: ['Ofitsiant'] }
    : { first_name: me.name, last_name: 'Testov', region: 'Toshkent shahri', district: 'Yunusobod', org: me.org, org_type: 'To‘yxona', address: 'Amir Temur ko‘chasi 1' };
  assert.equal(await status(who, '/me/profile', body), 200);
  if (me.role === 'worker') assert.equal(await status(who, '/me/photo', { data: JPEG }), 200);
  assert.equal((await call(who, '/me')).data.complete, true);
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const shift = { title: 'Ofitsiant', place: 'Chilonzor 9', date: today, start: '23:59', end: '23:59', pay: 250000, slots: 1 };

assert.equal(await status('biz', '/register', await withCode({ role: 'business', phone: '90 123 45 67', name: 'Aziz', org: 'Bahor to‘yxonasi', password: 'secret1' })), 200);
assert.equal(await status('w', '/register', await withCode({ role: 'worker', phone: '+998 93 111 22 33', name: 'Dilnoza', password: 'secret1' })), 200);
assert.equal(await status('x', '/register', await withCode({ role: 'worker', phone: '931112233', name: 'Boshqa', password: 'secret1' })), 409, 'bir raqam ikki marta');
assert.equal(await status('x', '/register', await withCode({ role: 'business', phone: '931112299', name: 'Org yo‘q', password: 'secret1' })), 400, 'biznes nomisiz');

assert.equal(await status('w', '/shifts', shift), 403, 'ishchi smena ochmaydi');
assert.equal((await call('biz', '/me')).data.complete, false, 'yangi hisob: profil to‘ldirilmagan');
assert.equal(await status('biz', '/shifts', shift), 403, 'profilsiz smena e’lon qilinmaydi');
await fill('biz');
await fill('w');
assert.equal(await status('biz', '/shifts', { ...shift, date: '2020-01-01' }), 400, 'o‘tgan sana');
assert.equal(await status('biz', '/shifts', { ...shift, date: '2026-02-30' }), 400, 'yo‘q sana');
const shiftId = (await call('biz', '/shifts', shift)).data.id;
assert.ok(shiftId);

assert.equal((await call('guest', '/shifts')).data.find((s: any) => s.id === shiftId).taken, 0, 'mehmon ham ro‘yxatni ko‘radi');

assert.equal(await status('w', `/shifts/${shiftId}/apply`, {}), 200);
assert.equal(await status('w', `/shifts/${shiftId}/apply`, {}), 409, 'ikki marta ariza');

let detail = (await call('biz', `/shifts/${shiftId}`)).data;
const appId = detail.applicants[0].id;
assert.equal(detail.applicants[0].phone, null, 'raqam qabulgacha yopiq');

await call('biz2', '/register', await withCode({ role: 'business', phone: '901112233', name: 'Begona', org: 'Begona MChJ', password: 'secret1' }));
assert.equal(await status('biz2', `/applications/${appId}`, { action: 'accept' }), 404, 'begona biznes');
assert.equal(await status('biz2', `/shifts/${shiftId}`), 404, 'begona smena');

assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 200);
assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 409, 'ikki marta qabul');
detail = (await call('biz', `/shifts/${shiftId}`)).data;
assert.equal(detail.applicants[0].phone, '+998931112233', 'qabuldan keyin raqam ochiq');

await call('w2', '/register', await withCode({ role: 'worker', phone: '935556677', name: 'Sardor', password: 'secret1' }));
assert.equal(await status('w2', `/shifts/${shiftId}/apply`, {}), 403, 'profilsiz ariza yo‘q');
await fill('w2');
assert.equal(await status('w2', `/shifts/${shiftId}/apply`, {}), 409, 'joy qolmadi');

assert.equal(await status('w', `/applications/${appId}/cancel`, {}), 409, 'smena kuni bekor qilib bo‘lmaydi');
assert.equal(await status('biz', `/applications/${appId}`, { action: 'noshow' }), 200);
assert.equal((await call('w', '/me')).data.blocked, true, 'kelmagan ishchi bloklandi');
assert.equal(await status('biz', `/applications/${appId}`, { action: 'came', rating: 5 }), 409, 'ikki marta belgilab bo‘lmaydi');

const shift2 = (await call('biz', '/shifts', { ...shift, slots: 1 })).data.id;
assert.equal(await status('w', `/shifts/${shift2}/apply`, {}), 403, 'bloklangan ariza bera olmaydi');

// Bir joyli smenaga ikki ariza: bir vaqtda qabul qilinsa ham faqat bittasi o'tadi
await call('w3', '/register', await withCode({ role: 'worker', phone: '937778899', name: 'Jasur', password: 'secret1' }));
await fill('w3');
assert.equal(await status('w2', `/shifts/${shift2}/apply`, {}), 200);
assert.equal(await status('w3', `/shifts/${shift2}/apply`, {}), 200);
const [first, second] = (await call('biz', `/shifts/${shift2}`)).data.applicants.map((a: any) => a.id);
const both = await Promise.all([status('biz', `/applications/${first}`, { action: 'accept' }), status('biz', `/applications/${second}`, { action: 'accept' })]);
assert.deepEqual(both.sort(), [200, 409], 'joydan ortiq qabul yo‘q');

const accepted = (await call('biz', `/shifts/${shift2}`)).data.applicants.find((a: any) => a.status === 'accepted').id;
assert.equal(await status('biz', `/applications/${accepted}`, { action: 'came', rating: 9 }), 400, 'baho 1–5');
assert.equal(await status('biz', `/applications/${accepted}`, { action: 'came', rating: 5 }), 200);
const worker = accepted === first ? 'w2' : 'w3';
assert.equal(await status(worker, `/applications/${accepted}/rate`, { rating: 4 }), 200);
assert.equal(await status(worker, `/applications/${accepted}/rate`, { rating: 4 }), 409, 'bir marta baholanadi');
assert.equal((await call(worker, '/me')).data.rating, 5);
assert.equal((await call('biz', '/me')).data.rating, 4);

assert.equal((await call('w2', '/login', { phone: '1' }, 'application/x-www-form-urlencoded')).status, 415, 'CSRF: faqat JSON');

assert.equal(await status('w2', '/logout', {}), 200);
assert.equal((await call('w2', '/me')).data, null);
assert.equal(await status('w2', '/login', { phone: '935556677', password: 'xato12' }), 401);
assert.equal(await status('w2', '/login', { phone: '935556677', password: 'secret1' }), 200);

// Admin paneli
assert.equal(await status('adm', '/admin/overview'), 401, 'kirmasdan admin ma’lumoti yo‘q');
assert.equal(await status('adm', '/admin/login', { password: 'xato' }), 401);
assert.equal(await status('adm', '/admin/login', { password: 'test-admin-parol' }), 200);
const ov = (await call('adm', '/admin/overview')).data;
const { workers, businesses, blocked, came, noshow, commission } = ov.stats;
assert.deepEqual([workers, businesses, blocked, came, noshow, commission], [3, 2, 1, 1, 1, 37500], 'raqamlar va 15% komissiya');
assert.equal(ov.users.length, 5);
assert.equal(ov.shifts.length, 2);
assert.equal(ov.applications.length, 3);
assert.equal(await status('w', '/admin/overview'), 401, 'oddiy foydalanuvchi admin emas');
const blockedId = ov.users.find((u: any) => u.blocked).id;
assert.equal(await status('adm', `/admin/users/${blockedId}`, { blocked: false }), 200);
assert.equal((await call('w', '/me')).data.blocked, false, 'admin blokdan chiqardi');
assert.equal(await status('adm', '/admin/users/9999', { blocked: true }), 404);
assert.equal(await status('adm', `/admin/users/${blockedId}`, { blocked: 'ha' }), 400);
const sardor = ov.users.find((u: any) => u.name === 'Sardor Testov').id;
const card = (await call('adm', `/admin/users/${sardor}`)).data;
assert.equal(card.user.phone, '+998935556677');
assert.equal(card.applications.length, 1, 'ishchining barcha arizalari');
assert.ok(card.sessions.active >= 1 && card.sessions.last_login, 'kirish sessiyalari');
assert.ok(!('pass' in card.user), 'parol xeshi ham tashqariga chiqmaydi');
assert.equal((await call('adm', `/admin/shifts/${shift2}`)).data.applicants.length, 2);
assert.equal(await status('w', `/admin/users/${sardor}`), 401, 'oddiy foydalanuvchi ko‘ra olmaydi');
const temp = (await call('adm', `/admin/users/${sardor}/password`, {})).data.password;
assert.equal((await call('w2', '/me')).data, null, 'parol tiklanganda eski kirishlar yopiladi');
assert.equal(await status('w2', '/login', { phone: '935556677', password: 'secret1' }), 401, 'eski parol ishlamaydi');
assert.equal(await status('w2', '/login', { phone: '935556677', password: temp }), 200, 'vaqtinchalik parol ishlaydi');
assert.equal((await call('adm', `/admin/users/${sardor}/logout`, {})).data.ended, 1);
assert.equal((await call('w2', '/me')).data, null, 'admin sessiyani yopdi');
await status('w2', '/login', { phone: '935556677', password: temp });
assert.equal(await status('adm', '/admin/logout', {}), 200);
assert.equal(await status('adm', '/admin/overview'), 401, 'chiqqandan keyin yopiq');

// Parol tanlashni cheklash: har urinish o'z IP manzilidan
const from = async (ip: string, path: string, body: object) =>
  (await handle({ method: 'POST', path: '/api' + path, cookie: '', contentType: 'application/json', body: JSON.stringify(body), https: false, ip })).status;
const wrong = (phone: string) => ({ phone, password: 'xato12' });
await call('l1', '/register', await withCode({ role: 'worker', phone: '935550001', name: 'Limit Bir', password: 'secret1' }));
await call('l2', '/register', await withCode({ role: 'worker', phone: '935550002', name: 'Limit Ikki', password: 'secret1' }));
await call('l3', '/register', await withCode({ role: 'worker', phone: '935550003', name: 'Limit Uch', password: 'secret1' }));

for (let i = 0; i < 10; i++) assert.equal(await from(`10.0.0.${i}`, '/login', wrong('935550001')), 401);
assert.equal(await from('10.0.1.1', '/login', { phone: '935550001', password: 'secret1' }), 429, 'bitta raqamga 10 ta xato: boshqa IPdan ham yopiq');
assert.equal(await from('10.0.1.1', '/login', { phone: '935550002', password: 'secret1' }), 200, 'boshqa raqamga ta’sir qilmaydi');

for (let i = 0; i < 20; i++) assert.equal(await from('10.0.2.1', '/login', wrong(`9355510${String(i).padStart(2, '0')}`)), 401);
assert.equal(await from('10.0.2.1', '/login', { phone: '935550002', password: 'secret1' }), 429, 'bitta IPdan 20 ta xato');
assert.equal(await from('10.0.2.2', '/login', { phone: '935550002', password: 'secret1' }), 200, 'boshqa IP ochiq');

for (let i = 0; i < 9; i++) await from(`10.0.3.${i}`, '/login', wrong('935550003'));
assert.equal(await from('10.0.3.9', '/login', { phone: '935550003', password: 'secret1' }), 200);
for (let i = 0; i < 9; i++) assert.equal(await from(`10.0.4.${i}`, '/login', wrong('935550003')), 401, 'to‘g‘ri kirish raqam hisobini nollaydi');

for (let i = 0; i < 10; i++) assert.equal(await from('10.0.5.1', '/admin/login', { password: 'xato' }), 401);
assert.equal(await from('10.0.5.1', '/admin/login', { password: 'test-admin-parol' }), 200, 'admin: xato paroldan keyin kutish yo‘q');
assert.equal(await from('10.0.5.3', '/admin/login', { password: '  test-admin-parol \n' }), 200, 'kiritilgan paroldagi bo‘shliq xalaqit bermaydi');
process.env.ADMIN_PASSWORD = '"test-admin-parol"\n';
assert.equal(await from('10.0.5.3', '/admin/login', { password: 'test-admin-parol' }), 200, 'Vercel’dagi qo‘shtirnoq va qator oxiri xalaqit bermaydi');
process.env.ADMIN_PASSWORD = 'test-admin-parol\u200B';
assert.equal(await from('10.0.5.3', '/admin/login', { password: 'test-admin-parol' }), 200, 'ko‘rinmas belgi xalaqit bermaydi');
assert.equal(await from('10.0.5.3', '/admin/login', { password: 'test-admin-paro' }), 401, 'boshqa parol baribir o‘tmaydi');
process.env.ADMIN_PASSWORD = 'test-admin-parol';

// Google orqali kirish
const tok = googleToken('uid-1');
assert.deepEqual((await call('g', '/google', { idToken: tok })).data, { signup: { name: 'Gulnora Karimova' } }, 'yangi Google hisobi: avval ro‘yxat');
assert.equal((await call('g', '/me')).data, null, 'ro‘yxatni yakunlamasdan sessiya yo‘q');
assert.equal(await status('g', '/google', await withCode({ idToken: tok, role: 'worker', name: 'Gulnora', phone: '935550002' }, true)), 409, 'band raqam');
assert.equal(await status('g', '/google', await withCode({ idToken: tok, role: 'business', name: 'Gulnora', phone: '935557001' }, true)), 400, 'biznes nomisiz');
const gUser = (await call('g', '/google', await withCode({ idToken: tok, role: 'worker', name: 'Gulnora', phone: '935557001' }, true))).data;
assert.equal(gUser.name, 'Gulnora');
assert.equal((await call('g', '/me')).data.first_name, 'Gulnora', 'Google ismi profilga yoziladi');
const g2tok = googleToken('uid-3', { name: 'Aziz Karimov', picture: 'https://yomon.example/rasm.jpg' });
const g2 = (await call('g5', '/google', await withCode({ idToken: g2tok, role: 'worker', name: 'Aziz Karimov', phone: '935557002' }, true))).data;
assert.deepEqual([g2.first_name, g2.last_name], ['Aziz', 'Karimov'], 'ism va familiya ajratiladi');
assert.equal(g2.photo, null, 'Google serveridan bo‘lmagan rasm olinmaydi');
assert.equal((await call('g', '/me')).data.id, gUser.id, 'ro‘yxatdan keyin kirgan');
assert.equal((await call('g2', '/google', { idToken: googleToken('uid-1') })).data.id, gUser.id, 'keyingi safar darhol kiradi');
assert.equal(await status('g3', '/login', { phone: '935557001', password: '' }), 401, 'Google hisobiga parol bilan kirib bo‘lmaydi');
const now = Math.floor(Date.now() / 1000);
for (const [bad, why] of [
  [googleToken('uid-2', { aud: 'boshqa-loyiha' }), 'boshqa Firebase loyihasi'],
  [googleToken('uid-2', { iss: 'https://securetoken.google.com/boshqa' }), 'boshqa iss'],
  [googleToken('uid-2', { exp: now - 10 }), 'muddati o‘tgan'],
  [googleToken('uid-2', { firebase: { sign_in_provider: 'password' } }), 'Google emas'],
  [googleToken('uid-2', { sub: '' }), 'uid yo‘q'],
  [googleToken('uid-2', {}, 'nomalum'), 'noma’lum kalit'],
  [tok.slice(0, -6) + 'AAAAAA', 'imzo buzilgan'],
  [`${tok.split('.')[0]}.${b64({ sub: 'uid-1' })}.${tok.split('.')[2]}`, 'ma’lumot almashtirilgan'],
  ['abc', 'token emas'],
  [undefined, 'token yo‘q'],
] as const) assert.equal(await status('g4', '/google', { idToken: bad }), 401, why);

// Profil
await call('p', '/register', await withCode({ role: 'worker', phone: '935558001', name: 'Profil', password: 'secret1' }));
const person = { first_name: 'Malika', last_name: 'Qodirova', region: 'Samarqand viloyati', district: 'Urgut', birth_date: '1999-03-15', gender: 'f', skills: ['Kassir', 'Hakker'], about: 'Tez ishlayman' };
assert.equal(await status('p', '/me/profile', { ...person, birth_date: `${Number(today.slice(0, 4)) - 15}-01-01` }), 400, '16 yoshdan kichik');
assert.equal(await status('p', '/me/profile', { ...person, district: 'Moskva' }), 400, 'ro‘yxatda yo‘q tuman');
assert.equal(await status('p', '/me/profile', { ...person, region: 'Moskva viloyati' }), 400, 'ro‘yxatda yo‘q viloyat');
assert.equal(await status('p', '/me/profile', { ...person, district: 'Chilonzor' }), 400, 'tuman boshqa viloyatniki');
assert.equal(await status('p', '/me/profile', { ...person, region: 'toString' }), 400, 'obyekt xossasi viloyat emas');
assert.equal(await status('p', '/me/profile', { ...person, gender: undefined }), 400, 'jinsi tanlanmagan');
assert.equal(await status('p', '/me/profile', { ...person, first_name: 'M' }), 400, 'ism juda qisqa');
const pr = (await call('p', '/me/profile', person)).data;
assert.equal(pr.name, 'Malika Qodirova', 'ism va familiya ko‘rsatiladigan ismga yoziladi');
assert.deepEqual(pr.skills, ['Kassir'], 'ro‘yxatda yo‘q ko‘nikma tashlanadi');
assert.ok(pr.age >= 26 && pr.age <= 28);
assert.equal(pr.complete, false, 'rasmsiz ishchi profili to‘liq emas');
assert.equal(await status('p', '/me/photo', { data: Buffer.from('\x89PNG' + 'x'.repeat(200)).toString('base64') }), 400, 'faqat JPEG');
const withPhoto = (await call('p', '/me/photo', { data: JPEG })).data;
assert.equal(withPhoto.complete, true);
assert.match(withPhoto.photo, /^\/api\/photos\/\d+\?v=/);
const photoPath = withPhoto.photo.split('?')[0].replace(/^\/api/, '');
assert.equal(await status('guest2', photoPath), 401, 'rasmni faqat kirganlar ko‘radi');
const img = await handle({ method: 'GET', path: '/api' + photoPath, cookie: jar.biz, contentType: null, body: '', https: false });
assert.equal(img.status, 200);
assert.deepEqual([...new Uint8Array(img.file!.body).slice(0, 3)], [0xff, 0xd8, 0xff], 'rasm o‘zi qaytadi');
assert.equal(await status('biz', '/me/profile', { first_name: 'Aziz', last_name: 'Karimov', region: 'Toshkent shahri', district: 'Yunusobod', org: 'Bahor', org_type: 'Kosmodrom', address: 'Amir Temur 1' }), 400, 'biznes turi ro‘yxatdan');
const biz3 = (await call('biz', '/shifts', { ...shift, slots: 2 })).data.id;
assert.equal(await status('p', `/shifts/${biz3}/apply`, {}), 200);
const shown = (await call('biz', `/shifts/${biz3}`)).data.applicants[0];
assert.deepEqual([shown.name, shown.region, shown.district, shown.skills, shown.photo === withPhoto.photo], ['Malika Qodirova', 'Samarqand viloyati', 'Urgut', ['Kassir'], true], 'biznes arizachining profilini ko‘radi');
assert.ok(!('birth_date' in shown) && shown.age === pr.age, 'tug‘ilgan sana emas, faqat yosh');

// Parolni almashtirish
assert.equal(await status('p', '/me/password', { old_password: 'xato12', new_password: 'yangi123' }), 401);
assert.equal(await status('p', '/me/password', { old_password: 'secret1', new_password: '123' }), 400);
assert.equal(await status('p', '/me/password', { old_password: 'secret1', new_password: 'yangi123' }), 200);
assert.equal((await call('p', '/me')).data.id, pr.id, 'shu qurilmada kirgan holda qoladi');
assert.equal(await status('p2', '/login', { phone: '935558001', password: 'secret1' }), 401, 'eski parol ishlamaydi');
assert.equal(await status('p2', '/login', { phone: '935558001', password: 'yangi123' }), 200);
assert.equal(await status('g', '/me/password', { old_password: '', new_password: 'yangi123' }), 409, 'Google hisobida parol yo‘q');

// Telegram kodi bilan raqamni tasdiqlash
const newbie = { role: 'worker', phone: '935559001', name: 'Yangi', password: 'secret1' };
const notLinked = await call('s', '/register/check', newbie);
assert.equal(notLinked.status, 428, 'raqam botga bog‘lanmagan');
assert.match(notLinked.data.error, /t\.me\/smenauzbbot/, 'xabarda bot havolasi');
assert.match(notLinked.data.error, /\+998 93 555 90 01 raqami botga bog‘lanmagan/, 'xabarda qaysi raqam');
assert.equal((await tg({ message: { chat: { id: 1, type: 'private' }, from: { id: 1 }, text: '/start' } }, 'xato')).status, 401, 'webhook maxfiy kalitsiz ishlamaydi');
process.env.TELEGRAM_BOT_TOKEN = ' "123:test"\n';
assert.equal((await tg({ message: { chat: { id: 1, type: 'private' }, from: { id: 1 }, text: '/start' } })).status, 200, 'Vercel’dagi bo‘shliq va qo‘shtirnoq tokenni buzmaydi');
process.env.TELEGRAM_BOT_TOKEN = '';
assert.equal((await tg({ message: { chat: { id: 1, type: 'private' }, from: { id: 1 }, text: '/start' } })).status, 503, 'token yo‘qligi alohida xato');
process.env.TELEGRAM_BOT_TOKEN = '123:test';
await tg({ message: { chat: { id: 900, type: 'private' }, from: { id: 900 }, text: '/start' } });
assert.ok(tgSent.at(-1).reply_markup.keyboard[0][0].request_contact, '/start: “Raqamni yuborish” tugmasi');
await tg({ message: { chat: { id: 901, type: 'private' }, from: { id: 901 }, contact: { phone_number: '998935559001', user_id: 777 } } });
assert.match(tgSent.at(-1).text, /o‘zingizning raqamingizni/, 'boshqa odamning kontakti qabul qilinmaydi');
assert.equal(await status('s', '/register/check', newbie), 428, 'begona kontakt raqamni bog‘lamadi');
await tg({ message: { chat: { id: 902, type: 'private' }, from: { id: 902 }, contact: { phone_number: '79001234567', user_id: 902 } } });
assert.match(tgSent.at(-1).text, /\+998/, 'faqat O‘zbekiston raqamlari');
await tg({ message: { chat: { id: 903, type: 'private' }, from: { id: 903 }, text: '+998 93 555 90 01' } });
assert.match(tgSent.at(-1).text, /Raqamni yozish shart emas/, 'qo‘lda yozilgan raqam: tugmani ko‘rsatadi');
assert.ok(tgSent.at(-1).reply_markup.keyboard[0][0].request_contact);
const newbieChat = await linkTg('935559001');
assert.deepEqual((await call('s', '/register/check', newbie)).data, { phone: '+998935559001', bot: 'smenauzbbot' }, 'kod Telegram’ga yuborildi');
assert.equal(tgSent.at(-1).chat_id, newbieChat, 'kod raqam bog‘langan chatga keladi');
assert.ok(tgSent.at(-1).protect_content, 'kod xabarini uzatib bo‘lmaydi');
const code1 = lastCode();
assert.equal(await status('s', '/register/check', newbie), 429, 'bir daqiqa ichida qayta kod yo‘q');
assert.equal(await status('s', '/register/check', { ...newbie, phone: '901234567' }), 409, 'band raqamga kod yuborilmaydi');
assert.equal(await status('s', '/register/check', { ...newbie, password: '1' }), 400, 'xato maydonda kod yuborilmaydi');
assert.equal(await status('s', '/register', newbie), 400, 'kodsiz ro‘yxat yo‘q');
assert.equal(await status('s', '/register', { ...newbie, code: code1 === '111111' ? '222222' : '111111' }), 400, 'noto‘g‘ri kod');
assert.equal(await status('s', '/register', { ...newbie, code: code1 }), 200, 'to‘g‘ri kod bilan ro‘yxat');

const other = { role: 'worker', phone: '935559003', name: 'Boshqa', password: 'secret1' };
await linkTg('935559003');
await call('s3', '/register/check', other);
const code3 = lastCode();
for (let i = 0; i < 5; i++) assert.equal(await status('s3', '/register', { ...other, code: code3 === '111111' ? '222222' : '111111' }), 400);
assert.equal(await status('s3', '/register', { ...other, code: code3 }), 429, '5 ta xatodan keyin kod yaroqsiz');
tgFail = true;
await linkTg('935559004');
assert.equal(await status('s4', '/register/check', { ...other, phone: '935559004' }), 502, 'bot bloklangan bo‘lsa aniq xato');
tgFail = false;

assert.equal(await status('s2', '/login/check', { phone: '935559002' }), 404, 'ro‘yxatda yo‘q raqamga kod yuborilmaydi');
assert.deepEqual((await call('s2', '/login/check', { phone: '93 555 90 01' })).data, { phone: '+998935559001', bot: 'smenauzbbot' }, 'ishlatilgan koddan keyin darhol yangi kod');
const loginCode = lastCode();
assert.equal(await status('s2', '/login/code', { phone: '935559001', code: '12' }), 400);
assert.equal((await call('s2', '/login/code', { phone: '935559001', code: loginCode })).data.name, 'Yangi', 'Telegram kodi bilan kirish');
assert.equal((await call('s2', '/me')).data.phone, '+998935559001');
assert.equal(await status('s5', '/login/code', { phone: '935559001', code: loginCode }), 400, 'kod bir martalik');

// Farbo (AI yordamchi): kalitsiz o'chiq; keyin soxta Gemini serveri bilan to'liq yo'l
const WAV = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVE', 'latin1'), Buffer.alloc(200)]).toString('base64');
assert.equal(await status('z', '/ai', {}), 400, 'savol yo‘q');
assert.equal(await status('z', '/ai', { audio: Buffer.from('salom').toString('base64') }), 400, 'WAV emas');
assert.equal(await status('z', '/ai', { text: 'salom' }), 503, 'kalitsiz Farbo o‘chiq');

let seen: any[] = [];
let answer: any = {};
let busyModel = '';
const fake = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    seen.push({ url: req.url, key: req.headers['x-goog-api-key'], body: JSON.parse(b) });
    res.statusCode = busyModel && req.url!.includes(`/${busyModel}:`) ? 503 : 200;
    res.end(JSON.stringify(answer));
  });
});
await new Promise<void>((r) => fake.listen(0, '127.0.0.1', () => r()));
process.env.GEMINI_BASE = `http://127.0.0.1:${(fake.address() as any).port}`;
process.env.GEMINI_API_KEY = 'test-kalit';
const said = (o: object) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ heard: '', shift_ids: [], link: '', ...o }) }] } }] });

const openShift = (await call('guest', '/shifts')).data[0];
answer = said({ heard: 'eshitilmagan', reply: 'Bugun bitta smena bor: 250 000 so‘m.', speech: 'Bugun bitta smena bor: ikki yuz ellik ming so‘m.', shift_ids: [openShift.id, 99999], link: '/qoidalar' });
const z = (await call('w', '/ai', { text: 'Bugungi ishlarni ayt', history: [{ role: 'user', text: 'salom' }, { role: 'hacker', text: 'x' }] })).data;
assert.equal(z.reply, 'Bugun bitta smena bor: 250 000 so‘m.');
assert.equal(z.speech, 'Bugun bitta smena bor: ikki yuz ellik ming so‘m.', 'ovoz uchun raqamlar so‘z bilan');
assert.deepEqual(z.shifts.map((s: any) => s.id), [openShift.id], 'faqat haqiqiy ochiq smena kartochka bo‘ladi');
assert.equal(z.heard, '', 'matnli savolda heard yo‘q');
assert.equal(z.link, '/qoidalar');
const sent = seen.at(-1);
assert.equal(sent.key, 'test-kalit');
assert.match(sent.url, /\/gemini-3\.5-flash:generateContent$/);
const sys = sent.body.systemInstruction.parts[0].text;
assert.ok(sys.includes(openShift.title) && sys.includes('arizalarim'), 'kontekstda ochiq smenalar va ishchining arizalari');
assert.ok(!/\+998/.test(sys), 'telefon raqamlar Gemini’ga yuborilmaydi');
assert.equal(sent.body.contents.length, 2, 'tarixdan noto‘g‘ri rol tashlanadi');

answer = said({ reply: 'Mana.', link: 'https://yomon.example' });
assert.equal((await call('biz', '/ai', { text: 'yangi arizalar bormi?' })).data.link, '', 'begona havola o‘tmaydi');
assert.ok(seen.at(-1).body.systemInstruction.parts[0].text.includes('smenalarim'), 'biznes kontekstida o‘z smenalari');

busyModel = 'gemini-3.5-flash';
assert.equal((await call('w', '/ai', { text: 'salom' })).data.reply, 'Mana.', 'asosiy model band: zaxira model javob beradi');
assert.match(seen.at(-1).url, /\/gemini-3\.1-flash-lite:/);
busyModel = '';

answer = said({ heard: 'Bugungi ishlarni ayt', reply: 'Hozir aytaman.' });
const voice = (await call('w', '/ai', { audio: WAV })).data;
assert.equal(voice.heard, 'Bugungi ishlarni ayt', 'ovozli savol matni qaytadi');
assert.equal(seen.at(-1).body.contents.at(-1).parts[0].inlineData.mimeType, 'audio/wav');

answer = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(480).toString('base64') } }] } }] };
const tts = await handle({ method: 'POST', path: '/api/ai/speak', cookie: jar.w, contentType: 'application/json', body: JSON.stringify({ text: 'Salom' }), https: false });
assert.equal(tts.status, 200);
assert.equal(tts.file!.type, 'audio/wav');
assert.equal(Buffer.from(tts.file!.body).toString('latin1', 0, 4), 'RIFF', 'xom PCM WAV ga o‘raladi');
assert.equal(tts.file!.body.byteLength, 44 + 480);
const ttsReq = seen.at(-1).body;
assert.equal(ttsReq.generationConfig.speechConfig.languageCode, 'uz-UZ', 'ovoz o‘zbek tilida');
assert.match(seen.at(-1).url, /\/gemini-3\.8-flash-tts:/);
await handle({ method: 'POST', path: '/api/ai/speak', cookie: jar.w, contentType: 'application/json', body: JSON.stringify({ text: 'Haqi 250 000 so‘m, 18:30 da, 1 200 000' }), https: false });
assert.equal(seen.at(-1).body.contents[0].parts[0].text, 'Haqi ikki yuz ellik ming so‘m, o‘n sakkiz o‘ttiz da, bir million ikki yuz ming', 'qolgan raqamlar ham o‘zbekcha');

answer = said({ reply: 'ok' });
for (let i = 0; i < 15; i++) assert.equal(await from('10.0.9.1', '/ai', { text: 'salom' }), 200);
assert.equal(await from('10.0.9.1', '/ai', { text: 'salom' }), 429, 'mehmonga 10 daqiqada 15 ta savol');
assert.equal(await from('10.0.9.2', '/ai', { text: 'salom' }), 200, 'boshqa IP ochiq');

// Admin panelidagi Farbo: faqat admin, limitsiz, butun platforma ma'lumoti, telefonlarsiz
assert.equal(await status('w', '/admin/ai', { text: 'salom' }), 401, 'oddiy foydalanuvchi admin Farbo’sini ishlata olmaydi');
await call('adm2', '/admin/login', { password: 'test-admin-parol' });
const someUser = (await call('adm2', '/admin/overview')).data.users[0];
answer = { candidates: [{ content: { parts: [{ text: JSON.stringify({ heard: '', reply: 'Bitta bloklangan ishchi bor.', user_ids: [someUser.id, 99999], shift_ids: [openShift.id, 99999] }) }] } }] };
const ad = (await call('adm2', '/admin/ai', { text: 'Kimlar bloklangan?' })).data;
assert.equal(ad.reply, 'Bitta bloklangan ishchi bor.');
assert.deepEqual(ad.refs.map((r: any) => `${r.kind}:${r.id}`), [`user:${someUser.id}`, `shift:${openShift.id}`], 'faqat bazadagi foydalanuvchi va smena havola bo‘ladi');
const adminSys = seen.at(-1).body.systemInstruction.parts[0].text;
assert.ok(adminSys.includes('statistika') && adminSys.includes('foydalanuvchilar') && adminSys.includes('arizalar'), 'admin konteksti');
assert.ok(!/\+998/.test(adminSys), 'admin kontekstida ham telefon raqamlar yo‘q');
for (let i = 0; i < 50; i++) assert.equal(await status('adm2', '/admin/ai', { text: 'salom' }), 200, 'admin uchun limit yo‘q');
for (let i = 0; i < 20; i++) assert.equal(await status('adm2', '/ai', { text: 'salom' }), 200, 'admin oddiy Farbo’da ham limitsiz');

// Obunalar: Farbo kunlik limiti tarifga bog'liq; Pro'ni admin yoqadi va o'zgartiradi
const addMonths = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
answer = said({ reply: 'ok' });
const sub = (await call('w2', '/me')).data;
assert.equal(sub.plan, 'free', 'yangi foydalanuvchi bepul tarifda');
for (let i = sub.ai_used; i < 30; i++) assert.equal(await status('w2', '/ai', { text: 'salom' }), 200);
assert.equal((await call('w2', '/me')).data.ai_used, 30, 'bugungi foydalanish profilda');
const over = await call('w2', '/ai', { text: 'salom' });
assert.equal(over.status, 429, 'bepul: kuniga 30 ta savol');
assert.match(over.data.error, /Pro obuna/, 'limit xabarida Pro taklifi');
assert.equal(await status('w2', `/admin/users/${sub.id}/plan`, { plan: 'pro', months: 1 }), 401, 'obunani faqat admin o‘zgartiradi');
assert.equal(await status('adm2', `/admin/users/${sub.id}/plan`, { plan: 'pro', months: 2 }), 400, 'muddat ro‘yxatdan');
assert.equal(await status('adm2', `/admin/users/${sub.id}/plan`, { plan: 'gold' }), 400);
assert.equal(await status('adm2', '/admin/users/99999/plan', { plan: 'free' }), 404);
assert.deepEqual((await call('adm2', `/admin/users/${sub.id}/plan`, { plan: 'pro', months: 1 })).data, { plan: 'pro', plan_until: addMonths(today, 1) });
const pro = (await call('w2', '/me')).data;
assert.deepEqual([pro.plan, pro.plan_until], ['pro', addMonths(today, 1)]);
const more = await call('w2', '/ai', { text: 'salom' });
assert.equal(more.status, 200, 'Pro: limit oshdi');
assert.equal(more.data.left, 300 - 30 - 1, 'qolgan savollar soni');
assert.equal((await call('adm2', `/admin/users/${sub.id}/plan`, { plan: 'pro', months: 3 })).data.plan_until, addMonths(addMonths(today, 1), 3), 'uzaytirish tugash sanasidan qo‘shiladi');
assert.equal((await call('adm2', '/admin/overview')).data.stats.pro, 1, 'statistikada Pro obunachilar');
assert.equal((await call('adm2', `/admin/users/${sub.id}`)).data.user.plan, 'pro', 'admin kartochkasida tarif');
assert.equal((await call('adm2', `/admin/users/${sub.id}/plan`, { plan: 'pro', months: 0 })).data.plan_until, null, 'muddatsiz Pro');
assert.equal((await call('adm2', `/admin/users/${sub.id}/plan`, { plan: 'free' })).data.plan, 'free');
assert.equal(await status('w2', '/ai', { text: 'salom' }), 429, 'bepulga qaytgach yana 30 ta chegarasi');
assert.equal((await call('guest', '/ai', { text: 'salom' })).data.left, null, 'mehmonga left yo‘q');

// Farbo biznes aytgan gapdan smena loyihasini tayyorlaydi: maydonlar tekshiriladi, smena o'zi e'lon qilinmaydi
const tmr = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const bizShiftsBefore = (await call('biz', '/my/shifts')).data.length;
answer = said({ reply: 'Loyiha tayyor. Formani tekshirib, e’lon qiling.', draft: { title: 'Ofitsiant', date: tmr, start: '18:00', end: '25:00', pay: 250000, slots: 5, place: 'Amir Temur ko‘chasi 1', note: '', urgent: true } });
const drafted = (await call('biz', '/ai', { text: 'Ertaga kechki 6 dan 5 ta ofitsiant kerak, 250 ming, shoshilinch' })).data;
assert.deepEqual(drafted.draft, { title: 'Ofitsiant', place: 'Amir Temur ko‘chasi 1', note: '', date: tmr, start: '18:00', end: '', pay: 250000, slots: 5, urgent: true }, 'noto‘g‘ri vaqt bo‘sh qoladi');
assert.ok(seen.at(-1).body.generationConfig.responseSchema.properties.draft, 'biznes so‘rovida loyiha sxemasi');
assert.match(seen.at(-1).body.systemInstruction.parts[0].text, /Amir Temur/, 'kontekstda biznes manzili');
assert.equal((await call('biz', '/my/shifts')).data.length, bizShiftsBefore, 'Farbo smenani o‘zi e’lon qilmaydi');
answer = said({ reply: 'ok', draft: { title: 'Ofitsiant', date: '2020-01-01' } });
assert.equal((await call('biz', '/ai', { text: 'smena' })).data.draft.date, '', 'o‘tgan sana bo‘sh qoladi');
assert.equal((await call('w', '/ai', { text: 'smena och' })).data.draft, null, 'ishchiga loyiha yo‘q');
assert.ok(!seen.at(-1).body.generationConfig.responseSchema.properties.draft);
fake.close();

// Admin: Telegram bot holati va ulash
assert.equal(await status('w', '/admin/telegram'), 401);
assert.equal((await call('adm2', '/admin/telegram')).data.connected, false, 'bot hali ulanmagan');
assert.equal(await status('adm2', '/admin/telegram', { action: 'connect' }), 400, 'http (lokal) manzilga ulanmaydi');
const conn = await handle({ method: 'POST', path: '/api/admin/telegram', cookie: jar.adm2, contentType: 'application/json', body: JSON.stringify({ action: 'connect' }), https: true, origin: 'https://smena.test' });
assert.equal(conn.status, 200);
assert.equal((conn.data as any).connected, true);
assert.equal(tgHook, 'https://smena.test/api/telegram/webhook');
assert.equal(tgSent.find((m) => m.method === 'setWebhook').secret_token, TG_SECRET, 'webhook maxfiy kaliti bilan');

// Demo ishlar: faqat admin qo'shadi va o'chiradi; "(demo)" belgili, ariza berib bo'lmaydi
assert.equal(await status('w', '/admin/demo', { action: 'add' }), 401);
assert.equal((await call('adm2', '/admin/demo', { action: 'add' })).data.added, 12);
const demoOpen = (await call('guest', '/shifts')).data.filter((s: any) => s.demo);
assert.equal(demoOpen.length, 12, 'demo smenalar ochiq ro‘yxatda (bugungi o‘tgani ertaga suriladi)');
assert.ok(demoOpen.every((s: any) => s.org.endsWith('(demo)')), 'biznes nomida (demo)');
assert.equal(await status('w3', `/shifts/${demoOpen[0].id}/apply`, {}), 409, 'demo smenaga ariza berilmaydi');
assert.equal(await status('x', '/login', { phone: '+998000000001', password: 'secret1' }), 401, 'demo biznes hisobiga kirib bo‘lmaydi');
assert.equal((await call('adm2', '/admin/demo', { action: 'add' })).data.added, 12, 'qayta bosilsa yangilanadi');
assert.equal((await call('guest', '/shifts')).data.filter((s: any) => s.demo).length, 12, 'ikki marta qo‘shilmaydi');
assert.equal((await call('adm2', '/admin/demo', { action: 'remove' })).data.removed, 12);
assert.equal((await call('guest', '/shifts')).data.filter((s: any) => s.demo).length, 0);
assert.ok(!(await call('adm2', '/admin/overview')).data.users.some((u: any) => u.phone.startsWith('+99800000000')), 'demo bizneslar ham o‘chdi');

// Admin foydalanuvchini o'chiradi: ishchi bilan arizalari, biznes bilan smenalari va ularning arizalari
const pId = (await call('p2', '/me')).data.id;
const pApps = (await call('biz', `/shifts/${biz3}`)).data.applicants.length;
assert.equal(await status('w', `/admin/users/${pId}/delete`, {}), 401, 'faqat admin o‘chiradi');
assert.equal(await status('adm2', '/admin/users/99999/delete', {}), 404);
assert.equal((await call('adm2', `/admin/users/${pId}/delete`, {})).data.applications, 1);
assert.equal((await call('p2', '/me')).data, null, 'o‘chirilgan foydalanuvchining kirishi yopildi');
assert.equal(await status('p3', '/login', { phone: '935558001', password: 'yangi123' }), 401);
assert.equal((await call('biz', `/shifts/${biz3}`)).data.applicants.length, pApps - 1, 'arizasi ham o‘chdi');
assert.equal(await status('p4', '/register', await withCode({ role: 'worker', phone: '935558001', name: 'Qayta', password: 'secret1' })), 200, 'raqam bo‘shadi');
const bizId = (await call('biz', '/me')).data.id;
const del = (await call('adm2', `/admin/users/${bizId}/delete`, {})).data;
assert.ok(del.shifts >= 3, 'biznesning smenalari ham o‘chdi');
assert.ok(!(await call('guest', '/shifts')).data.some((x: any) => x.org === 'Bahor to‘yxonasi'), 'smenalari ro‘yxatda yo‘q');
assert.ok(!(await call('adm2', '/admin/overview')).data.users.some((u: any) => u.id === bizId));

// --- Telegram bildirishnomalari, sevimlilar, takroriy smenalar, filtr, "Keldim", eslatmalar va tillar ---
const tgTo = (chat: number) => tgSent.filter((m) => m.method === 'sendMessage' && m.chat_id === chat);
const lastTo = (chat: number) => tgTo(chat).at(-1)?.text ?? '';
const tgReg = async (who: string, body: any) => {
  const chat = await linkTg(body.phone);
  const r = await call('kod', '/register/check', body);
  assert.equal(r.status, 200);
  assert.equal(await status(who, '/register', { ...body, code: lastCode() }), 200);
  await fill(who);
  return chat;
};
const bizChat = await tgReg('nb', { role: 'business', phone: '901110001', name: 'Nodir', org: 'Navro‘z restorani', password: 'secret1' });
const wChat = await tgReg('nw', { role: 'worker', phone: '931110001', name: 'Madina', password: 'secret1' });
const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

// Ariza → biznesga, qabul → ishchiga xabar (biznes raqami bilan)
const ns = (await call('nb', '/shifts', { ...shift, date: tomorrow, start: '10:00', end: '18:00', title: 'Kassir', pay: 300000, slots: 2 })).data.id;
assert.equal(await status('nw', `/shifts/${ns}/apply`, {}), 200);
assert.match(lastTo(bizChat), /Yangi ariza: Madina/, 'biznesga yangi ariza xabari');
assert.match(lastTo(bizChat), new RegExp(`/ilova/smena/${ns}`), 'xabarda arizalar havolasi');
let nApp = (await call('nb', `/shifts/${ns}`)).data.applicants[0];
assert.equal(nApp.badge, 'new', 'hali smena bajarmagan ishchi: yangi');
assert.equal(nApp.reliability, null);
assert.equal(await status('nb', `/applications/${nApp.id}`, { action: 'accept' }), 200);
assert.match(lastTo(wChat), /qabul qilindi/, 'ishchiga qabul xabari');
assert.match(lastTo(wChat), /\+998 90 111 00 01/, 'xabarda ish beruvchi raqami');
assert.equal(await status('nw', `/applications/${nApp.id}/checkin`, {}), 409, 'ertangi smenaga bugun “Keldim” bosib bo‘lmaydi');
assert.equal((await call('nw', '/my/applications')).data.find((a: any) => a.id === nApp.id).can_checkin, false);

// Eslatma tugmasi: begona chat bosa olmaydi; ertangi smenada "Kela olmayman" — bepul bekor qilish
const cb = (from: number, data: string) => tg({ callback_query: { id: 'q' + data, from: { id: from }, data, message: { chat: { id: from }, message_id: 7 } } });
await cb(bizChat, `c:${nApp.id}:n`);
assert.equal((await call('nb', `/shifts/${ns}`)).data.applicants.length, 1, 'begona chat tugmasi hech narsa qilmaydi');
await cb(wChat, `c:${nApp.id}:n`);
assert.equal((await call('nb', `/shifts/${ns}`)).data.applicants.length, 0, 'ertangi smena: “Kela olmayman” arizani bekor qiladi');
assert.match(lastTo(bizChat), /Madina Testov arizasini bekor qildi/);

// Sevimlilar: faqat o'z smenasiga ariza bergan ishchi
assert.equal(await status('nw', `/shifts/${ns}/apply`, {}), 200, 'bekor qilgandan keyin qayta ariza');
assert.equal(await status('nb', `/applications/${(await call('nb', `/shifts/${ns}`)).data.applicants[0].id}`, { action: 'accept' }), 200);
assert.equal(await status('nb', `/favorites/${(await call('w2', '/me')).data.id}`, { on: true }), 404, 'begona ishchini sevimli qilib bo‘lmaydi');
const nwId = (await call('nw', '/me')).data.id;
assert.equal(await status('nw', `/favorites/${nwId}`, { on: true }), 403, 'ishchi sevimli qila olmaydi');
assert.equal((await call('nb', `/favorites/${nwId}`, { on: true })).data.favorite, true);
const favs = (await call('nb', '/favorites')).data;
assert.equal(favs.length, 1);
assert.equal(favs[0].name, 'Madina Testov');
assert.equal(favs[0].phone, '+998931110001', 'avval qabul qilingan ishchining raqami ko‘rinadi');

// Takroriy smena (har hafta, 3 ta) va sevimlilarga xabar
const before = tgTo(wChat).length;
const series = (await call('nb', '/shifts', { ...shift, date: tomorrow, start: '09:00', end: '13:00', title: 'Promouter', pay: 150000, repeat: 'weekly', times: 3, notify: true })).data;
assert.equal(series.ids.length, 3, 'takroriy: 3 ta smena');
const seriesDates = (await call('nb', '/my/shifts')).data.filter((x: any) => series.ids.includes(x.id)).map((x: any) => x.date).sort();
assert.equal(Date.parse(seriesDates[1]) - Date.parse(seriesDates[0]), 7 * 864e5, 'bir haftadan keyin');
assert.equal(tgTo(wChat).length, before + 1, 'sevimli ishchiga bitta xabar');
assert.match(lastTo(wChat), /3 ta yangi smena/);
assert.equal(await status('nb', '/shifts', { ...shift, repeat: 'monthly', times: 2 }), 400, 'noma’lum takror');
assert.equal(await status('nb', '/shifts', { ...shift, repeat: 'daily', times: 30 }), 400, 'ko‘pi bilan 12 ta');

// Taklif: sevimli ishchiga, bir smenaga bir marta
assert.equal(await status('nb', `/favorites/${nwId}/invite`, { shift_id: series.ids[1] }), 200);
assert.match(lastTo(wChat), /taklif qilmoqda/);
assert.equal(await status('nb', `/favorites/${nwId}/invite`, { shift_id: series.ids[1] }), 409, 'ikki marta taklif yo‘q');
assert.equal(await status('nb', `/favorites/${nwId}/invite`, { shift_id: 999999 }), 404, 'yo‘q smenaga taklif yo‘q');
const listed = (await call('nw', '/shifts')).data;
assert.ok(listed.find((x: any) => x.id === series.ids[1]).invited, 'ro‘yxatda: taklif qilingan');
assert.ok(listed.find((x: any) => x.id === series.ids[0]).fav, 'ro‘yxatda: meni sevimli qilgan biznes');
assert.equal(listed.find((x: any) => x.id === series.ids[0]).org_done, 0);
assert.equal((await call('nb', `/favorites/${nwId}`, { on: false })).data.favorite, false);
assert.equal((await call('nb', '/favorites')).data.length, 0);

// Filtr va qidiruv
const ids = (r: any) => r.data.map((x: any) => x.id);
assert.ok(ids(await call('guest', '/shifts?q=promo')).includes(series.ids[0]), 'qidiruv: lavozim (katta-kichik harf farqsiz)');
assert.ok(ids(await call('guest', '/shifts?q=Navro')).includes(ns), 'qidiruv: biznes nomi');
assert.equal((await call('guest', '/shifts?q=yo%27q-narsa-xyz')).data.length, 0);
assert.ok((await call('guest', '/shifts?q=%25')).data.length === 0, '% qidiruvda oddiy belgi');
assert.ok((await call('guest', '/shifts?when=tomorrow')).data.every((x: any) => x.date === tomorrow), 'ertangi smenalar');
assert.ok(!ids(await call('guest', '/shifts?when=week')).includes(series.ids[2]), 'shu hafta: 14 kundan keyingisi yo‘q');
assert.ok((await call('guest', '/shifts?min_pay=290000')).data.every((x: any) => x.pay >= 290000), 'eng kam haq');
const byPay = (await call('guest', '/shifts?sort=pay')).data.map((x: any) => x.pay);
assert.deepEqual(byPay, [...byPay].sort((a, b) => b - a), 'avval qimmati');
assert.ok((await call('guest', '/shifts?district=Yunusobod')).data.every((x: any) => x.org_district === 'Yunusobod'), 'tuman bo‘yicha');
assert.ok((await call('nw', '/shifts?mine=1')).data.every((x: any) => x.title === 'Ofitsiant'), 'ko‘nikmalarimga mos (Ofitsiant)');

// Bugungi smena: "Keldim", 3 soat oldin eslatma va smena kuni "Kela olmayman" → biznes ozod qiladi
const tNow = new Date(Date.now() + 5 * 3600_000);
const hhmm = (d: Date) => d.toISOString().slice(11, 16);
if (tNow.getUTCHours() < 22) {
  const soon = (await call('nb', '/shifts', { ...shift, start: hhmm(new Date(tNow.getTime() + 40 * 60_000)), end: '23:59', title: 'Ofitsiant', slots: 3 })).data.id;
  const wChat2 = await tgReg('nw2', { role: 'worker', phone: '931110002', name: 'Kamola', password: 'secret1' });
  for (const who of ['nw', 'nw2']) assert.equal(await status(who, `/shifts/${soon}/apply`, {}), 200);
  for (const a of (await call('nb', `/shifts/${soon}`)).data.applicants) assert.equal(await status('nb', `/applications/${a.id}`, { action: 'accept' }), 200);
  const [a1, a2] = (await call('nb', `/shifts/${soon}`)).data.applicants;
  // Soat 18:00 dan keyin ertangi qabul qilingan smenaga ham (Madina, "Kassir") kun oldingi eslatma ketadi
  assert.equal((await call('guest', '/cron/reminders')).data.sent, tNow.getUTCHours() >= 18 ? 3 : 2, '3 soat ichidagi smena: ikkalasiga eslatma');
  assert.equal((await call('guest', '/cron/reminders')).data.skipped, true, 'daqiqada bir martadan ko‘p ishlamaydi');
  const reminder = tgTo(wChat).at(-1);
  assert.match(reminder.text, /Eslatma/);
  assert.equal(reminder.reply_markup.inline_keyboard[0][0].callback_data, `c:${a1.id}:y`, '“Kelaman” tugmasi');
  assert.equal((await call('adm2', '/cron/reminders')).data.sent, 0, 'eslatma bir marta');
  await cb(wChat, `c:${a1.id}:y`);
  assert.match(lastTo(bizChat), /Madina Testov kelishini tasdiqladi/);
  await cb(wChat, `c:${a1.id}:n`);
  assert.equal((await call('nb', `/shifts/${soon}`)).data.applicants.find((x: any) => x.id === a1.id).confirm, 'yes', 'javob bir marta');
  await cb(wChat2, `c:${a2.id}:n`);
  assert.match(lastTo(bizChat), /Kamola Testov bugun kela olmasligini aytdi/);
  assert.equal(await status('nb', `/applications/${a1.id}`, { action: 'release' }), 409, 'kelaman deganni ozod qilib bo‘lmaydi');
  assert.equal(await status('nb', `/applications/${a2.id}`, { action: 'release' }), 200);
  assert.match(lastTo(wChat2), /ozod qildi/);
  assert.equal((await call('nw2', '/me')).data.blocked, false, 'ozod qilingan ishchi bloklanmaydi');
  assert.equal((await call('nb', `/shifts/${soon}`)).data.shift.taken, 1, 'joy bo‘shadi');
  // "Keldim": smenadan bir soat oldin ochiladi, biznesga xabar, bir marta
  assert.equal((await call('nw', '/my/applications')).data.find((a: any) => a.id === a1.id).can_checkin, true);
  assert.equal(await status('nw2', `/applications/${a1.id}/checkin`, {}), 404, 'begona ariza');
  assert.equal((await call('nw', `/applications/${a1.id}/checkin`, {})).status, 200);
  assert.match(lastTo(bizChat), /Madina Testov joyiga keldi/);
  assert.equal(await status('nw', `/applications/${a1.id}/checkin`, {}), 409, 'ikki marta yo‘q');
  const checked = (await call('nb', `/shifts/${soon}`)).data.applicants.find((x: any) => x.id === a1.id);
  assert.ok(checked.checkin_at, 'biznes “Keldim” vaqtini ko‘radi');
  assert.equal((await call('nb', '/my/shifts')).data.find((x: any) => x.id === soon).checked_in, 1);
  assert.equal(await status('nb', `/applications/${a1.id}`, { action: 'came', rating: 5 }), 200);
  assert.match(lastTo(wChat), /Smena bajarildi/);
  const me = (await call('nw', '/me')).data;
  assert.equal(me.done, 1);
  assert.equal(me.checkins, 1);
  assert.equal(me.reliability, 100, 'kelish foizi');
} else {
  console.log('(Toshkentda kech: bugungi smena sinovlari o‘tkazib yuborildi)');
}

// Tillar: xatolar va bot javoblari tanlangan tilda; til foydalanuvchiga saqlanadi
const asLang = (lang: string, path: string) => handle({ method: 'GET', path: '/api' + path, cookie: `lang=${lang}`, contentType: null, body: '', https: false });
assert.equal(((await asLang('ru', '/my/applications')).data as any).error, 'Сначала войдите в аккаунт');
assert.equal(((await asLang('en', '/my/applications')).data as any).error, 'Please sign in first');
assert.equal(((await asLang('xx', '/my/applications')).data as any).error, 'Avval hisobingizga kiring', 'noma’lum til: o‘zbekcha');
const enShift = await handle({ method: 'POST', path: '/api/shifts', cookie: `${jar.nb}; lang=en`, contentType: 'application/json', body: JSON.stringify({ ...shift, title: 'x' }), https: false });
assert.equal((enShift.data as any).error, 'Position: must be 2–80 characters', 'maydon nomi ham tarjima');
// Til cookie'si sessiya cookie'sini almashtirmasin: jar'ga yozilmaydi
const setRu = await handle({ method: 'POST', path: '/api/lang', cookie: jar.nb, contentType: 'application/json', body: JSON.stringify({ lang: 'ru' }), https: false });
assert.equal((setRu.data as any).lang, 'ru');
assert.match(setRu.cookie ?? '', /^lang=ru;/);
assert.equal((await handle({ method: 'POST', path: '/api/lang', cookie: '', contentType: 'application/json', body: '{"lang":"de"}', https: false })).status, 400);
assert.equal((await call('nb', '/me')).data.lang, 'ru', 'til bazada');
await status('nw', `/shifts/${series.ids[0]}/apply`, {});
assert.match(lastTo(bizChat), /Новая заявка: Madina/, 'biznesga xabar uning tilida');
await tg({ message: { chat: { id: 555, type: 'private' }, from: { id: 555, language_code: 'ru' }, text: '/start' } });
assert.match(tgSent.at(-1).text, /Здравствуйте/, 'bot Telegram tilida javob beradi');
assert.equal(tgSent.at(-1).reply_markup.keyboard[0][0].text, '📱 Отправить номер');

// --- Xarita, shoshilinch smenalar, "Keldim" joylashuvi, haq, sharhlar, brigada, taklif, hisobot va Mini App ---
const HERE = { lat: 41.311081, lng: 69.240562 };
const north = (m: number) => ({ lat: Math.round((HERE.lat + m / 111_195) * 1e6) / 1e6, lng: HERE.lng });
const gbChat = await tgReg('gb', { role: 'business', phone: '901120001', name: 'Gulshan', org: 'Gulshan kafe', password: 'secret1' });
const gbId = (await call('gb', '/me')).data.id;
const later = { ...shift, date: tomorrow, start: '10:00', end: '12:00' };
assert.equal(await status('gb', '/shifts', { ...later, lat: 55.75, lng: 37.61 }), 400, 'O‘zbekistondan tashqari joy yo‘q');
assert.equal(await status('gb', '/shifts', { ...later, lat: 'abc', lng: 69 }), 400, 'noto‘g‘ri koordinata');
const mapped = (await call('gb', '/shifts', { ...later, title: 'Barista', ...HERE })).data.id;
assert.deepEqual([(await call('gb', '/me')).data.lat, (await call('gb', '/me')).data.lng], [HERE.lat, HERE.lng], 'biznesning oxirgi joyi saqlanadi');
const far = (await call('gb', '/shifts', { ...later, start: '11:00', title: 'Barista', ...north(5000) })).data.id;
const byNear = (await call('guest', `/shifts?near=${north(4900).lat},${HERE.lng}`)).data;
assert.equal(byNear[0].id, far, 'yaqinimdagilar: eng yaqini birinchi');
assert.ok(Math.abs(byNear[0].distance - 100) <= 2, 'masofa metrda');
assert.ok(byNear.find((x: any) => x.id === mapped).distance > 4800);
assert.equal(byNear.at(-1).distance, null, 'joyi belgilanmaganlar oxirida');
assert.ok((await call('guest', `/shifts?org=${gbId}`)).data.every((x: any) => x.business_id === gbId), 'bitta biznesning smenalari');

// Smena bajarildi: yozma sharh, "Haqimni oldim" tugmalari, haqni o'z vaqtida to'lash foizi
const gwChat = await tgReg('gw', { role: 'worker', phone: '931120001', name: 'Shahzod', password: 'secret1' });
const gw2Chat = await tgReg('gw2', { role: 'worker', phone: '931120002', name: 'Zarina', password: 'secret1' });
const gwId = (await call('gw', '/me')).data.id;
const doneShift = async (who: string, review?: string) => {
  const id = (await call('gb', '/shifts', { ...shift, title: 'Kassir' })).data.id;
  assert.equal(await status(who, `/shifts/${id}/apply`, {}), 200);
  const app = (await call('gb', `/shifts/${id}`)).data.applicants[0];
  assert.equal(await status('gb', `/applications/${app.id}`, { action: 'accept' }), 200);
  assert.equal(await status('gb', `/applications/${app.id}`, { action: 'came', rating: 5, review }), 200);
  return { shiftId: id, appId: app.id };
};
const job = await doneShift('gw', '  Juda   tirishqoq, vaqtida keldi ');
assert.equal(tgTo(gwChat).at(-1).reply_markup.inline_keyboard[0][0].callback_data, `p:${job.appId}:y`, '“Haqimni oldim” tugmasi');
await cb(gbChat, `p:${job.appId}:y`);
assert.equal((await call('gw', '/my/applications')).data.find((a: any) => a.id === job.appId).paid, null, 'begona chat haqni belgilay olmaydi');
await cb(gwChat, `p:${job.appId}:n`);
assert.match(lastTo(gbChat), /Shahzod Testov .* haqini hali olmaganini aytdi/, 'biznesga ogohlantirish');
assert.equal(await status('gw', `/applications/${job.appId}/paid`, { got: false }), 409, 'ikki marta “olmadim” yo‘q');
assert.equal((await call('gw', `/applications/${job.appId}/paid`, { got: true })).data.paid, 'late', '“olmadim” dan keyin — kechikib');
assert.match(lastTo(gbChat), /haqini olganini tasdiqladi/);
assert.equal(await status('gw', `/applications/${job.appId}/paid`, { got: true }), 409);
assert.equal(await status('gw', `/applications/${job.appId}/rate`, { rating: 4, review: '  Yaxshi   jamoa ' }), 200);
const org = (await call('guest', `/orgs/${gbId}`)).data;
assert.equal(org.org.paid_pct, 0, 'kechikkan to‘lov o‘z vaqtida hisoblanmaydi');
assert.deepEqual(org.reviews.map((r: any) => [r.rating, r.text, r.author]), [[4, 'Yaxshi jamoa', 'Shahzod T.']], 'sharh va qisqartirilgan ism');
assert.equal(await status('guest', `/orgs/${gwId}`), 404, 'ishchi biznes sahifasi emas');

// Shoshilinch: faqat bugun/ertaga, takrorsiz; ro'yxatda tepada; xabar — yaqindagi ishonchli ishchiga (yangi ishchiga emas)
const in3 = new Date(Date.now() + 3 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
assert.equal(await status('gb', '/shifts', { ...later, date: in3, urgent: true }), 400, 'shoshilinch — faqat bugun yoki ertaga');
assert.equal(await status('gb', '/shifts', { ...later, urgent: true, repeat: 'daily', times: 2 }), 400, 'shoshilinch takrorlanmaydi');
assert.deepEqual((await call('gw', '/me/location', north(300))).data, north(300));
const gw2Before = tgTo(gw2Chat).length;
const urgent = (await call('gb', '/shifts', { ...later, start: '08:00', title: 'Oshpaz', urgent: true, ...HERE })).data;
assert.equal(urgent.alerted, 1, 'faqat ishonchli va yaqin ishchiga');
assert.match(lastTo(gwChat), /Shoshilinch smena, sizdan \d+ m uzoqlikda/);
assert.equal(tgTo(gw2Chat).length, gw2Before, 'hali smena bajarmagan ishchiga xabar yo‘q');
assert.equal((await call('guest', '/shifts')).data[0].id, urgent.id, 'shoshilinch smena ro‘yxat tepasida');
assert.ok((await call('guest', '/shifts?urgent=1')).data.every((x: any) => x.urgent === 1));
assert.deepEqual((await call('gw', '/me/location', { clear: true })).data, { lat: null, lng: null });

// "Keldim": smena joyi belgilangan bo'lsa, joylashuv shart va 300 m ichida
if (tNow.getUTCHours() < 22) {
  const here = (await call('gb', '/shifts', { ...shift, start: hhmm(new Date(tNow.getTime() + 40 * 60_000)), title: 'Ofitsiant', ...HERE })).data.id;
  assert.equal(await status('gw', `/shifts/${here}/apply`, {}), 200);
  const app = (await call('gb', `/shifts/${here}`)).data.applicants[0];
  assert.equal(await status('gb', `/applications/${app.id}`, { action: 'accept' }), 200);
  assert.equal(await status('gw', `/applications/${app.id}/checkin`, {}), 400, 'joylashuvsiz “Keldim” yo‘q');
  const tooFar = await call('gw', `/applications/${app.id}/checkin`, north(2000));
  assert.equal(tooFar.status, 409);
  assert.match(tooFar.data.error, /smena joyidan 2,0 km uzoqdasiz/);
  const arrived = (await call('gw', `/applications/${app.id}/checkin`, north(120))).data;
  assert.ok(Math.abs(arrived.checkin_dist - 120) <= 2, 'masofa saqlanadi');
  assert.match(lastTo(gbChat), /smena joyidan 12\d m/, 'biznesga masofa bilan');
  assert.equal((await call('gb', `/shifts/${here}`)).data.applicants[0].checkin_dist, arrived.checkin_dist);
}

// Brigada: taklif (Telegram tugmasi yoki ilova), boshliq hamma nomidan ariza beradi, biznes bir bosishda qabul qiladi
const gw3Chat = await tgReg('gw3', { role: 'worker', phone: '931120003', name: 'Bekzod', password: 'secret1' });
assert.equal(await status('gw', '/brigade/invite', { phone: '931120002' }), 404, 'avval brigada tuziladi');
const team = (await call('gw', '/brigade', { name: 'Tezkor jamoa' })).data;
assert.equal(team.brigade.mine, true);
assert.equal(await status('gw', '/brigade', { name: 'Ikkinchi' }), 409, 'bitta brigada');
assert.equal(await status('gw', '/brigade/invite', { phone: '931120099' }), 404, 'ro‘yxatda yo‘q raqam');
assert.equal(await status('gw', '/brigade/invite', { phone: '901120001' }), 404, 'biznes brigadaga qo‘shilmaydi');
assert.equal(await status('gw', '/brigade/invite', { phone: '931120001' }), 400, 'o‘zini taklif qilmaydi');
await call('gw', '/brigade/invite', { phone: '931120002' });
assert.equal(await status('gw', '/brigade/invite', { phone: '931120002' }), 409, 'ikki marta taklif yo‘q');
const invite = tgTo(gw2Chat).at(-1);
assert.match(invite.text, /Tezkor jamoa/);
await cb(gw2Chat, invite.reply_markup.inline_keyboard[0][0].callback_data);
await call('gw', '/brigade/invite', { phone: '931120003' });
assert.equal((await call('gw3', '/brigade')).data.invites[0].name, 'Tezkor jamoa', 'ilovada taklif ko‘rinadi');
assert.equal((await call('gw3', '/brigade/answer', { id: team.brigade.id, accept: true })).data.brigade.members.length, 3);
assert.match(lastTo(gwChat), /Bekzod Testov .*brigadangizga qo‘shildi/);
const small = (await call('gb', '/shifts', { ...later, start: '14:00', title: 'Yuk tashuvchi', slots: 2 })).data.id;
assert.equal(await status('gw', `/shifts/${small}/apply`, { brigade: true }), 409, '3 kishiga 2 joy yetmaydi');
const big = (await call('gb', '/shifts', { ...later, start: '15:00', title: 'Yuk tashuvchi', slots: 3 })).data.id;
assert.equal(await status('gw2', `/shifts/${big}/apply`, { brigade: true }), 403, 'faqat boshliq brigada nomidan');
assert.equal((await call('gw', `/shifts/${big}/apply`, { brigade: true })).data.team, 3);
assert.match(lastTo(gbChat), /Yangi brigada arizasi: “Tezkor jamoa”, 3 kishi/);
assert.match(lastTo(gw3Chat), /brigadasi nomidan smenaga ariza berdi/);
const crew = (await call('gb', `/shifts/${big}`)).data.applicants;
assert.deepEqual(crew.map((a: any) => a.brigade_name), ['Tezkor jamoa', 'Tezkor jamoa', 'Tezkor jamoa']);
assert.equal((await call('gb', `/applications/${crew[1].id}`, { action: 'accept_team' })).data.accepted, 3);
assert.equal((await call('gb', `/shifts/${big}`)).data.shift.taken, 3, 'hammasi qabul qilindi');
assert.match(lastTo(gw2Chat), /qabul qilindi/);
assert.equal(await status('gb', `/applications/${crew[0].id}`, { action: 'accept_team' }), 409, 'ikki marta yo‘q');
assert.equal(await status('gw', `/brigade/members/${gwId}/remove`, {}), 400);
await call('gw3', '/brigade/leave', {});
assert.match(lastTo(gwChat), /Bekzod Testov .*brigadangizdan chiqdi/);
await call('gw', '/brigade/leave', {});
assert.match(lastTo(gw2Chat), /brigadasi tarqatildi/);
assert.equal((await call('gw2', '/brigade')).data.brigade, null);

// Taklif: do'st ro'yxatdan o'tadi, birinchi smenasini bajaradi — taklif qilganga 1 hafta Pro (bir marta)
const code = (await call('gw', '/me')).data.ref_code;
const rfChat = await tgReg('rf', { role: 'worker', phone: '931120009', name: 'Rustam', password: 'secret1', ref: code });
await tgReg('rf2', { role: 'worker', phone: '931120010', name: 'Nomalum', password: 'secret1', ref: 'zzzzzz' });
assert.deepEqual((await call('gw', '/me')).data.referrals, { invited: 1, rewarded: 0 }, 'noto‘g‘ri kod hisoblanmaydi');
const rfJob = await doneShift('rf');
const week = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
const gwMe = (await call('gw', '/me')).data;
assert.deepEqual([gwMe.plan, gwMe.plan_until, gwMe.referrals.rewarded], ['pro', week, 1], 'taklif qilganga 1 hafta Pro');
assert.match(lastTo(gwChat), /1 hafta Pro sovg‘a qilindi/);
await doneShift('rf');
assert.equal((await call('gw', '/me')).data.plan_until, week, 'sovg‘a bir marta');
assert.equal((await call('rf', `/applications/${rfJob.appId}/paid`, { got: true })).data.paid, 'yes', 'smena kuni olingan haq — o‘z vaqtida');
assert.equal((await call('guest', `/orgs/${gbId}`)).data.org.paid_pct, 50, '1 ta o‘z vaqtida, 1 ta kechikib');
assert.equal((await call('guest', `/shifts?org=${gbId}`)).data[0].org_paid, 50, 'ro‘yxatda ham');
assert.ok(rfChat);

// Bizneslar ishchi haqida yozgan sharhlar arizachilar ro'yxatida ko'rinadi
const again = (await call('gb', '/shifts', { ...later, start: '16:00', title: 'Kassir' })).data.id;
await call('gw', `/shifts/${again}/apply`, {});
assert.deepEqual((await call('gb', `/shifts/${again}`)).data.applicants[0].reviews.map((r: any) => [r.rating, r.text]), [[5, 'Juda tirishqoq, vaqtida keldi']]);

// Oylik hisobot: ishchiga topgani, ulush va qo'liga tushgani; biznesga to'lagani
const month = today.slice(0, 7);
const rep = (await call('gw', '/me/report')).data.months.find((m: any) => m.month === month);
assert.deepEqual([rep.shifts, rep.gross, rep.share, rep.net], [1, 250000, 37500, 212500]);
assert.equal((await call('gb', '/me/report')).data.total.gross, 750000, 'biznes: 3 ta bajarilgan smena');
assert.equal(await status('guest', '/me/report'), 401);

// Telegram Mini App: imzo bot tokeni bilan tekshiriladi, bog'langan raqam orqali parolsiz kiriladi
const tgInit = (user: object, authDate = Math.floor(Date.now() / 1000), token = '123:test') => {
  const data = new URLSearchParams({ query_id: 'AAHtest', user: JSON.stringify(user), auth_date: String(authDate) });
  const check = [...data.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  data.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(token).digest()).update(check).digest('hex'));
  return data.toString();
};
const viaApp = await call('mini', '/telegram/app', { initData: tgInit({ id: gwChat, first_name: 'Shahzod' }) });
assert.equal(viaApp.data.name, 'Shahzod Testov', 'Mini App: avtomatik kirish');
assert.equal((await call('mini', '/me')).data.id, gwId, 'sessiya ochildi');
assert.equal(await status('mini2', '/telegram/app', { initData: tgInit({ id: gwChat }).replace('Shahzod', 'x') + '&x=1' }), 401, 'o‘zgartirilgan ma’lumot');
assert.equal(await status('mini2', '/telegram/app', { initData: tgInit({ id: gwChat }, Math.floor(Date.now() / 1000) - 2 * 86400) }), 401, 'eskirgan');
assert.equal(await status('mini2', '/telegram/app', { initData: tgInit({ id: gwChat }, undefined, '999:boshqa') }), 401, 'boshqa bot imzosi');
assert.deepEqual((await call('mini2', '/telegram/app', { initData: tgInit({ id: 424242 }) })).data, { linked: false, bot: 'smenauzbbot' }, 'raqam bog‘lanmagan');
const loneChat = await linkTg('931120077');
assert.deepEqual((await call('mini2', '/telegram/app', { initData: tgInit({ id: loneChat }) })).data, { linked: true, registered: false, phone: '+998931120077' });
assert.match(tgSent.at(-1).reply_markup.inline_keyboard[0][0].web_app.url, /^https:\/\/.+\/ilova\/smenalar$/, 'raqam bog‘langach ilova tugmasi');
await tg({ message: { chat: { id: gwChat, type: 'private' }, from: { id: gwChat }, text: '/start' } });
assert.match(tgSent.at(-1).text, /Raqamingiz bog‘langan: \+998 93 112 00 01/);
assert.ok(tgSent.at(-1).reply_markup.inline_keyboard[0][0].web_app, '/start: “Smena’ni ochish” tugmasi');
await handle({ method: 'POST', path: '/api/admin/telegram', cookie: jar.adm2, contentType: 'application/json', body: '{"action":"connect"}', https: true, origin: 'https://smena.test' });
assert.equal(tgSent.findLast((m) => m.method === 'setChatMenuButton')?.menu_button.web_app.url, 'https://smena.test/ilova/smenalar', 'menyu tugmasi ilovani ochadi');

tgFake.close();
console.log('Hammasi joyida ✓');
