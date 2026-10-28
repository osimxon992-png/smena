// API o'z-o'zini tekshirish: node test.ts (vaqtinchalik xotiradagi baza bilan)
import assert from 'node:assert/strict';

process.env.DB = ':memory:';
// Baza yo'li import paytida o'qiladi, shuning uchun api muhit o'rnatilgandan keyin yuklanadi
const { handle } = await import('./lib/api.ts');

const jar: Record<string, string> = {};
function call(who: string, path: string, body?: object, contentType = 'application/json') {
  const res = handle({ method: body ? 'POST' : 'GET', path: '/api' + path, cookie: jar[who] ?? '', contentType, body: body ? JSON.stringify(body) : '', https: false });
  if (res.cookie) jar[who] = res.cookie.split(';')[0];
  return res as { status: number; data: any };
}

const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const shift = { title: 'Ofitsiant', place: 'Chilonzor 9', date: today, start: '23:59', end: '23:59', pay: 250000, slots: 1 };

assert.equal(call('biz', '/register', { role: 'business', phone: '90 123 45 67', name: 'Aziz', org: 'Bahor to‘yxonasi', password: 'secret1' }).status, 200);
assert.equal(call('w', '/register', { role: 'worker', phone: '+998 93 111 22 33', name: 'Dilnoza', password: 'secret1' }).status, 200);
assert.equal(call('x', '/register', { role: 'worker', phone: '931112233', name: 'Boshqa', password: 'secret1' }).status, 409, 'bir raqam ikki marta');
assert.equal(call('x', '/register', { role: 'business', phone: '931112299', name: 'Org yo‘q', password: 'secret1' }).status, 400, 'biznes nomisiz');

assert.equal(call('w', '/shifts', shift).status, 403, 'ishchi smena ochmaydi');
assert.equal(call('biz', '/shifts', { ...shift, date: '2020-01-01' }).status, 400, 'o‘tgan sana');
assert.equal(call('biz', '/shifts', { ...shift, date: '2026-02-30' }).status, 400, 'yo‘q sana');
const shiftId = call('biz', '/shifts', shift).data.id;
assert.ok(shiftId);

assert.equal(call('guest', '/shifts').data.find((s: any) => s.id === shiftId).taken, 0, 'mehmon ham ro‘yxatni ko‘radi');

assert.equal(call('w', `/shifts/${shiftId}/apply`, {}).status, 200);
assert.equal(call('w', `/shifts/${shiftId}/apply`, {}).status, 409, 'ikki marta ariza');

let detail = call('biz', `/shifts/${shiftId}`).data;
const appId = detail.applicants[0].id;
assert.equal(detail.applicants[0].phone, null, 'raqam qabulgacha yopiq');

call('biz2', '/register', { role: 'business', phone: '901112233', name: 'Begona', org: 'Begona MChJ', password: 'secret1' });
assert.equal(call('biz2', `/applications/${appId}`, { action: 'accept' }).status, 404, 'begona biznes');
assert.equal(call('biz2', `/shifts/${shiftId}`).status, 404, 'begona smena');

assert.equal(call('biz', `/applications/${appId}`, { action: 'accept' }).status, 200);
detail = call('biz', `/shifts/${shiftId}`).data;
assert.equal(detail.applicants[0].phone, '+998931112233', 'qabuldan keyin raqam ochiq');

call('w2', '/register', { role: 'worker', phone: '935556677', name: 'Sardor', password: 'secret1' });
assert.equal(call('w2', `/shifts/${shiftId}/apply`, {}).status, 409, 'joy qolmadi');

assert.equal(call('w', `/applications/${appId}/cancel`, {}).status, 409, 'smena kuni bekor qilib bo‘lmaydi');
assert.equal(call('biz', `/applications/${appId}`, { action: 'noshow' }).status, 200);
assert.equal(call('w', '/me').data.blocked, true, 'kelmagan ishchi bloklandi');

const shift2 = call('biz', '/shifts', { ...shift, slots: 3 }).data.id;
assert.equal(call('w', `/shifts/${shift2}/apply`, {}).status, 403, 'bloklangan ariza bera olmaydi');

assert.equal(call('w2', `/shifts/${shift2}/apply`, {}).status, 200);
const app2 = call('biz', `/shifts/${shift2}`).data.applicants[0].id;
call('biz', `/applications/${app2}`, { action: 'accept' });
assert.equal(call('biz', `/applications/${app2}`, { action: 'came', rating: 9 }).status, 400, 'baho 1–5');
assert.equal(call('biz', `/applications/${app2}`, { action: 'came', rating: 5 }).status, 200);
assert.equal(call('w2', `/applications/${app2}/rate`, { rating: 4 }).status, 200);
assert.equal(call('w2', `/applications/${app2}/rate`, { rating: 4 }).status, 409, 'bir marta baholanadi');
assert.equal(call('w2', '/me').data.rating, 5);
assert.equal(call('biz', '/me').data.rating, 4);

assert.equal(call('w2', '/login', { phone: '1' }, 'application/x-www-form-urlencoded').status, 415, 'CSRF: faqat JSON');

assert.equal(call('w2', '/logout', {}).status, 200);
assert.equal(call('w2', '/me').data, null);
assert.equal(call('w2', '/login', { phone: '935556677', password: 'xato12' }).status, 401);
assert.equal(call('w2', '/login', { phone: '935556677', password: 'secret1' }).status, 200);

console.log('Hammasi joyida ✓');
