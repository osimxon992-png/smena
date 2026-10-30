// API o'z-o'zini tekshirish: node test.ts (vaqtinchalik xotiradagi libSQL bazasi bilan)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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

for (let i = 0; i < 5; i++) assert.equal(await from('10.0.5.1', '/admin/login', { password: 'xato' }), 401);
assert.equal(await from('10.0.5.1', '/admin/login', { password: 'test-admin-parol' }), 429, 'admin: bitta IPdan 5 ta xato');
assert.equal(await from('10.0.5.2', '/admin/login', { password: 'test-admin-parol' }), 200, 'admin: boshqa IP ochiq');

// Google orqali kirish
const tok = googleToken('uid-1');
assert.deepEqual((await call('g', '/google', { idToken: tok })).data, { signup: { name: 'Gulnora Karimova' } }, 'yangi Google hisobi: avval ro‘yxat');
assert.equal((await call('g', '/me')).data, null, 'ro‘yxatni yakunlamasdan sessiya yo‘q');
assert.equal(await status('g', '/google', { idToken: tok, role: 'worker', name: 'Gulnora', phone: '935550002', phoneToken: sms('935550002') }), 409, 'band raqam');
assert.equal(await status('g', '/google', { idToken: tok, role: 'business', name: 'Gulnora', phone: '935557001', phoneToken: sms('935557001') }), 400, 'biznes nomisiz');
const gUser = (await call('g', '/google', { idToken: tok, role: 'worker', name: 'Gulnora', phone: '935557001', phoneToken: sms('935557001') })).data;
assert.equal(gUser.name, 'Gulnora');
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

console.log('Hammasi joyida ✓');
