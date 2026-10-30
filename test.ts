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
const { handle } = await import('./lib/api.ts');

const jar: Record<string, string> = {};
async function call(who: string, path: string, body?: object, contentType = 'application/json') {
  const res = await handle({ method: body ? 'POST' : 'GET', path: '/api' + path, cookie: jar[who] ?? '', contentType, body: body ? JSON.stringify(body) : '', https: false });
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
// SMS kod bilan tasdiqlangan raqam
const e164 = (phone: string) => { const d = phone.replace(/\D/g, ''); return '+' + (d.length === 9 ? '998' + d : d); };
const sms = (phone: string, claims: object = {}) => firebaseToken({ sub: 'sms' + e164(phone), phone_number: e164(phone), firebase: { sign_in_provider: 'phone' }, ...claims });

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

assert.equal(await status('biz', '/register', { role: 'business', phone: '90 123 45 67', name: 'Aziz', org: 'Bahor to‘yxonasi', password: 'secret1', phoneToken: sms('90 123 45 67') }), 200);
assert.equal(await status('w', '/register', { role: 'worker', phone: '+998 93 111 22 33', name: 'Dilnoza', password: 'secret1', phoneToken: sms('+998 93 111 22 33') }), 200);
assert.equal(await status('x', '/register', { role: 'worker', phone: '931112233', name: 'Boshqa', password: 'secret1', phoneToken: sms('931112233') }), 409, 'bir raqam ikki marta');
assert.equal(await status('x', '/register', { role: 'business', phone: '931112299', name: 'Org yo‘q', password: 'secret1', phoneToken: sms('931112299') }), 400, 'biznes nomisiz');

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

await call('biz2', '/register', { role: 'business', phone: '901112233', name: 'Begona', org: 'Begona MChJ', password: 'secret1', phoneToken: sms('901112233') });
assert.equal(await status('biz2', `/applications/${appId}`, { action: 'accept' }), 404, 'begona biznes');
assert.equal(await status('biz2', `/shifts/${shiftId}`), 404, 'begona smena');

assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 200);
assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 409, 'ikki marta qabul');
detail = (await call('biz', `/shifts/${shiftId}`)).data;
assert.equal(detail.applicants[0].phone, '+998931112233', 'qabuldan keyin raqam ochiq');

await call('w2', '/register', { role: 'worker', phone: '935556677', name: 'Sardor', password: 'secret1', phoneToken: sms('935556677') });
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
await call('w3', '/register', { role: 'worker', phone: '937778899', name: 'Jasur', password: 'secret1', phoneToken: sms('937778899') });
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
await call('l1', '/register', { role: 'worker', phone: '935550001', name: 'Limit Bir', password: 'secret1', phoneToken: sms('935550001') });
await call('l2', '/register', { role: 'worker', phone: '935550002', name: 'Limit Ikki', password: 'secret1', phoneToken: sms('935550002') });
await call('l3', '/register', { role: 'worker', phone: '935550003', name: 'Limit Uch', password: 'secret1', phoneToken: sms('935550003') });

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

// Google orqali kirish
const tok = googleToken('uid-1');
assert.deepEqual((await call('g', '/google', { idToken: tok })).data, { signup: { name: 'Gulnora Karimova' } }, 'yangi Google hisobi: avval ro‘yxat');
assert.equal((await call('g', '/me')).data, null, 'ro‘yxatni yakunlamasdan sessiya yo‘q');
assert.equal(await status('g', '/google', { idToken: tok, role: 'worker', name: 'Gulnora', phone: '935550002', phoneToken: sms('935550002') }), 409, 'band raqam');
assert.equal(await status('g', '/google', { idToken: tok, role: 'business', name: 'Gulnora', phone: '935557001', phoneToken: sms('935557001') }), 400, 'biznes nomisiz');
const gUser = (await call('g', '/google', { idToken: tok, role: 'worker', name: 'Gulnora', phone: '935557001', phoneToken: sms('935557001') })).data;
assert.equal(gUser.name, 'Gulnora');
assert.equal((await call('g', '/me')).data.first_name, 'Gulnora', 'Google ismi profilga yoziladi');
const g2tok = googleToken('uid-3', { name: 'Aziz Karimov', picture: 'https://yomon.example/rasm.jpg' });
const g2 = (await call('g5', '/google', { idToken: g2tok, role: 'worker', name: 'Aziz Karimov', phone: '935557002', phoneToken: sms('935557002') })).data;
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
await call('p', '/register', { role: 'worker', phone: '935558001', name: 'Profil', password: 'secret1', phoneToken: sms('935558001') });
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

// SMS bilan raqamni tasdiqlash
const newbie = { role: 'worker', phone: '935559001', name: 'Yangi', password: 'secret1' };
assert.deepEqual((await call('s', '/register/check', newbie)).data, { phone: '+998935559001' }, 'SMS dan oldin tekshiruv');
assert.equal(await status('s', '/register/check', { ...newbie, phone: '901234567' }), 409, 'band raqamga SMS yuborilmaydi');
assert.equal(await status('s', '/register/check', { ...newbie, password: '1' }), 400, 'xato maydonda SMS yuborilmaydi');
assert.equal(await status('s', '/register/check', { ...newbie, password: undefined, google: true }), 200, 'Google ro‘yxatida parol so‘ralmaydi');
assert.equal(await status('s', '/register', newbie), 401, 'tasdiqlanmagan raqam bilan ro‘yxat yo‘q');
assert.equal(await status('s', '/register', { ...newbie, phoneToken: sms('935559999') }), 400, 'kod boshqa raqamga');
assert.equal(await status('s', '/register', { ...newbie, phoneToken: sms('935559001', { auth_time: Math.floor(Date.now() / 1000) - 3600 }) }), 401, 'eski kod');
assert.equal(await status('s', '/register', { ...newbie, phoneToken: googleToken('uid-9', { phone_number: '+998935559001' }) }), 401, 'Google tokeni SMS o‘rnida emas');
assert.equal(await status('s', '/register', { ...newbie, phoneToken: sms('935559001') }), 200);

assert.equal(await status('s2', '/login/check', { phone: '935559002' }), 404, 'ro‘yxatda yo‘q raqamga SMS yuborilmaydi');
assert.deepEqual((await call('s2', '/login/check', { phone: '93 555 90 01' })).data, { phone: '+998935559001' });
assert.equal(await status('s2', '/login/sms', { phoneToken: sms('935559002') }), 404);
assert.equal(await status('s2', '/login/sms', { phoneToken: 'abc' }), 401);
assert.equal((await call('s2', '/login/sms', { phoneToken: sms('935559001') })).data.name, 'Yangi', 'SMS kod bilan kirish');
assert.equal((await call('s2', '/me')).data.phone, '+998935559001');

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
fake.close();

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
assert.equal(await status('p4', '/register', { role: 'worker', phone: '935558001', name: 'Qayta', password: 'secret1', phoneToken: sms('935558001') }), 200, 'raqam bo‘shadi');
const bizId = (await call('biz', '/me')).data.id;
const del = (await call('adm2', `/admin/users/${bizId}/delete`, {})).data;
assert.ok(del.shifts >= 3, 'biznesning smenalari ham o‘chdi');
assert.ok(!(await call('guest', '/shifts')).data.some((x: any) => x.org === 'Bahor to‘yxonasi'), 'smenalari ro‘yxatda yo‘q');
assert.ok(!(await call('adm2', '/admin/overview')).data.users.some((u: any) => u.id === bizId));

console.log('Hammasi joyida ✓');
