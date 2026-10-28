// API o'z-o'zini tekshirish: node test.js (vaqtinchalik xotiradagi baza bilan)
process.env.DB = ':memory:';
const assert = require('node:assert/strict');
const server = require('./server');

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/api`;
  const jar = {};
  async function call(who, path, body) {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', cookie: jar[who] || '' },
      body: body && JSON.stringify(body),
    });
    const cookie = res.headers.get('set-cookie');
    if (cookie) jar[who] = cookie.split(';')[0];
    return { status: res.status, data: await res.json() };
  }

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
    const shift = { title: 'Ofitsiant', place: 'Chilonzor 9', date: today, start: '23:59', end: '23:59', pay: 250000, slots: 1 };

    assert.equal((await call('biz', '/register', { role: 'business', phone: '90 123 45 67', name: 'Aziz', org: 'Bahor to‘yxonasi', password: 'secret1' })).status, 200);
    assert.equal((await call('w', '/register', { role: 'worker', phone: '+998 93 111 22 33', name: 'Dilnoza', password: 'secret1' })).status, 200);
    assert.equal((await call('x', '/register', { role: 'worker', phone: '931112233', name: 'Boshqa', password: 'secret1' })).status, 409, 'bir raqam ikki marta');
    assert.equal((await call('x', '/register', { role: 'business', phone: '931112299', name: 'Org yo‘q', password: 'secret1' })).status, 400, 'biznes nomisiz');

    assert.equal((await call('w', '/shifts', shift)).status, 403, 'ishchi smena ochmaydi');
    assert.equal((await call('biz', '/shifts', { ...shift, date: '2020-01-01' })).status, 400, 'o‘tgan sana');
    assert.equal((await call('biz', '/shifts', { ...shift, date: '2026-02-30' })).status, 400, 'yo‘q sana');
    const { data: { id: shiftId } } = await call('biz', '/shifts', shift);
    assert.ok(shiftId);

    const list = (await call('guest', '/shifts')).data;
    assert.equal(list.find((s) => s.id === shiftId).taken, 0, 'mehmon ham ro‘yxatni ko‘radi');

    assert.equal((await call('w', `/shifts/${shiftId}/apply`, {})).status, 200);
    assert.equal((await call('w', `/shifts/${shiftId}/apply`, {})).status, 409, 'ikki marta ariza');

    let detail = (await call('biz', `/shifts/${shiftId}`)).data;
    const appId = detail.applicants[0].id;
    assert.equal(detail.applicants[0].phone, null, 'raqam qabulgacha yopiq');

    await call('biz2', '/register', { role: 'business', phone: '901112233', name: 'Begona', org: 'Begona MChJ', password: 'secret1' });
    assert.equal((await call('biz2', `/applications/${appId}`, { action: 'accept' })).status, 404, 'begona biznes');
    assert.equal((await call('biz2', `/shifts/${shiftId}`)).status, 404, 'begona smena');

    assert.equal((await call('biz', `/applications/${appId}`, { action: 'accept' })).status, 200);
    detail = (await call('biz', `/shifts/${shiftId}`)).data;
    assert.equal(detail.applicants[0].phone, '+998931112233', 'qabuldan keyin raqam ochiq');

    await call('w2', '/register', { role: 'worker', phone: '935556677', name: 'Sardor', password: 'secret1' });
    assert.equal((await call('w2', `/shifts/${shiftId}/apply`, {})).status, 409, 'joy qolmadi');

    assert.equal((await call('w', `/applications/${appId}/cancel`, {})).status, 409, 'smena kuni bekor qilib bo‘lmaydi');
    assert.equal((await call('biz', `/applications/${appId}`, { action: 'noshow' })).status, 200);
    assert.equal((await call('w', '/me')).data.blocked, true, 'kelmagan ishchi bloklandi');

    const { data: { id: shift2 } } = await call('biz', '/shifts', { ...shift, slots: 3 });
    assert.equal((await call('w', `/shifts/${shift2}/apply`, {})).status, 403, 'bloklangan ariza bera olmaydi');

    assert.equal((await call('w2', `/shifts/${shift2}/apply`, {})).status, 200);
    const app2 = (await call('biz', `/shifts/${shift2}`)).data.applicants[0].id;
    await call('biz', `/applications/${app2}`, { action: 'accept' });
    assert.equal((await call('biz', `/applications/${app2}`, { action: 'came', rating: 9 })).status, 400, 'baho 1–5');
    assert.equal((await call('biz', `/applications/${app2}`, { action: 'came', rating: 5 })).status, 200);
    assert.equal((await call('w2', `/applications/${app2}/rate`, { rating: 4 })).status, 200);
    assert.equal((await call('w2', `/applications/${app2}/rate`, { rating: 4 })).status, 409, 'bir marta baholanadi');
    assert.equal((await call('w2', '/me')).data.rating, 5);
    assert.equal((await call('biz', '/me')).data.rating, 4);

    const form = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'phone=1' });
    assert.equal(form.status, 415, 'CSRF: faqat JSON');

    assert.equal((await call('w2', '/logout', {})).status, 200);
    assert.equal((await call('w2', '/me')).data, null);
    assert.equal((await call('w2', '/login', { phone: '935556677', password: 'xato12' })).status, 401);
    assert.equal((await call('w2', '/login', { phone: '935556677', password: 'secret1' })).status, 200);

    const origin = base.replace('/api', '');
    for (const page of ['/', '/qanday-ishlaydi.html', '/qoidalar.html', '/bizneslar.html', '/savollar.html']) {
      const html = await (await fetch(origin + page)).text();
      assert.ok(html.includes('class="nav') && html.includes('class="footer') && !html.includes('<!-- include'), `${page}: header va footer qo‘shilgan`);
    }

    console.log('Hammasi joyida ✓');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
