// API o'z-o'zini tekshirish: node test.ts (vaqtinchalik xotiradagi libSQL bazasi bilan)
import assert from 'node:assert/strict';

process.env.TURSO_DATABASE_URL = ':memory:';
// Baza manzili import paytida o'qiladi, shuning uchun api muhit o'rnatilgandan keyin yuklanadi
const { handle } = await import('./lib/api.ts');

const jar: Record<string, string> = {};
async function call(who: string, path: string, body?: object, contentType = 'application/json') {
  const res = await handle({ method: body ? 'POST' : 'GET', path: '/api' + path, cookie: jar[who] ?? '', contentType, body: body ? JSON.stringify(body) : '', https: false });
  if (res.cookie) jar[who] = res.cookie.split(';')[0];
  return res as { status: number; data: any };
}
const status = async (who: string, path: string, body?: object) => (await call(who, path, body)).status;

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const shift = { title: 'Ofitsiant', place: 'Chilonzor 9', date: today, start: '23:59', end: '23:59', pay: 250000, slots: 1 };

assert.equal(await status('biz', '/register', { role: 'business', phone: '90 123 45 67', name: 'Aziz', org: 'Bahor to‘yxonasi', password: 'secret1' }), 200);
assert.equal(await status('w', '/register', { role: 'worker', phone: '+998 93 111 22 33', name: 'Dilnoza', password: 'secret1' }), 200);
assert.equal(await status('x', '/register', { role: 'worker', phone: '931112233', name: 'Boshqa', password: 'secret1' }), 409, 'bir raqam ikki marta');
assert.equal(await status('x', '/register', { role: 'business', phone: '931112299', name: 'Org yo‘q', password: 'secret1' }), 400, 'biznes nomisiz');

assert.equal(await status('w', '/shifts', shift), 403, 'ishchi smena ochmaydi');
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

await call('biz2', '/register', { role: 'business', phone: '901112233', name: 'Begona', org: 'Begona MChJ', password: 'secret1' });
assert.equal(await status('biz2', `/applications/${appId}`, { action: 'accept' }), 404, 'begona biznes');
assert.equal(await status('biz2', `/shifts/${shiftId}`), 404, 'begona smena');

assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 200);
assert.equal(await status('biz', `/applications/${appId}`, { action: 'accept' }), 409, 'ikki marta qabul');
detail = (await call('biz', `/shifts/${shiftId}`)).data;
assert.equal(detail.applicants[0].phone, '+998931112233', 'qabuldan keyin raqam ochiq');

await call('w2', '/register', { role: 'worker', phone: '935556677', name: 'Sardor', password: 'secret1' });
assert.equal(await status('w2', `/shifts/${shiftId}/apply`, {}), 409, 'joy qolmadi');

assert.equal(await status('w', `/applications/${appId}/cancel`, {}), 409, 'smena kuni bekor qilib bo‘lmaydi');
assert.equal(await status('biz', `/applications/${appId}`, { action: 'noshow' }), 200);
assert.equal((await call('w', '/me')).data.blocked, true, 'kelmagan ishchi bloklandi');
assert.equal(await status('biz', `/applications/${appId}`, { action: 'came', rating: 5 }), 409, 'ikki marta belgilab bo‘lmaydi');

const shift2 = (await call('biz', '/shifts', { ...shift, slots: 1 })).data.id;
assert.equal(await status('w', `/shifts/${shift2}/apply`, {}), 403, 'bloklangan ariza bera olmaydi');

// Bir joyli smenaga ikki ariza: bir vaqtda qabul qilinsa ham faqat bittasi o'tadi
await call('w3', '/register', { role: 'worker', phone: '937778899', name: 'Jasur', password: 'secret1' });
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

console.log('Hammasi joyida ✓');
