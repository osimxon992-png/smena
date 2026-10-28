// Smena ilovasi: hash-router, har bir sahifa HTML qaytaradigan funksiya.
const header = document.querySelector('.top');
const main = document.querySelector('main');
let me = null;
let installEvt = null;

const STATUS = { pending: 'Kutilmoqda', accepted: 'Qabul qilindi', rejected: 'Rad etildi', came: 'Bajarildi', noshow: 'Kelmadi' };
const DONE = { apply: 'Ariza yuborildi', cancel: 'Ariza bekor qilindi', accept: 'Ishchi qabul qilindi', reject: 'Ariza rad etildi', noshow: 'Ishchi bloklandi' };
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const som = (n) => `${Number(n).toLocaleString('ru-RU')} so‘m`;
const tashkentDate = (plusDays = 0) => new Date(Date.now() + plusDays * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const home = () => (me?.role === 'business' ? '#/biznes' : '#/smenalar');

function day(iso) {
  if (iso === tashkentDate()) return 'Bugun';
  if (iso === tashkentDate(1)) return 'Ertaga';
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${DAYS[d.getUTCDay()]}`;
}

async function api(path, body) {
  let res;
  try {
    res = await fetch('/api' + path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Internet aloqasi yo‘q. Ulanib, qayta urinib ko‘ring');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Xatolik yuz berdi');
  return data;
}

function go(hash) {
  if (location.hash === hash) render(true);
  else location.hash = hash;
}

function guard(role) {
  if (!me) go('#/kirish');
  else if (me.role !== role) go(home());
  else return true;
  return false;
}

let toastTimer;
function toast(text, isError = false) {
  const t = document.querySelector('.toast');
  t.textContent = text;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// --- Bo'laklar ---

const field = (label, input, cls = '') => `<label class="field ${cls}"><span>${label}</span>${input}</label>`;
const phoneInput = () => '<div class="phone"><span>+998</span><input type="tel" name="phone" required inputmode="tel" autocomplete="tel-national" placeholder="90 123 45 67"></div>';
const empty = (title, html) => `<div class="empty"><h2>${title}</h2><p>${html}</p></div>`;
const blockedBanner = () => (me?.blocked ? '<p class="banner danger">Qabul qilingan smenaga kelmaganingiz uchun hisobingiz bloklangan. Yangi smenalarga ariza bera olmaysiz.</p>' : '');
const tel = (phone) => `<a href="tel:${esc(phone)}">${esc(phone)}</a>`;

function ticket(s, aside = '') {
  const org = s.org ? `<p class="ticket-org">${esc(s.org)}${s.org_rating ? ` <span class="stars">★ ${s.org_rating}</span>` : ''}</p>` : '';
  const slots = s.slots ? `<span class="slots">${s.taken}/${s.slots} joy band</span>` : '';
  return `<article class="ticket">
    <div class="ticket-time">
      <span class="ticket-day">${esc(day(s.date))}</span>
      <span class="ticket-clock">${esc(s.start_time)}</span>
      <span class="ticket-until">${esc(s.end_time)} gacha</span>
    </div>
    <div class="ticket-body">
      <h2 class="ticket-title">${esc(s.title)}</h2>
      ${org}
      <p class="ticket-place">${esc(s.place)}</p>
      ${s.note ? `<p class="ticket-note">${esc(s.note)}</p>` : ''}
      <div class="ticket-foot"><strong class="pay">${som(s.pay)}</strong>${slots}</div>
      ${aside && `<div class="ticket-aside">${aside}</div>`}
    </div>
  </article>`;
}

const starsForm = (form, id, legend, button) => `<form class="rate" data-form="${form}" data-id="${id}">
  <fieldset><legend>${legend}</legend><div class="stars-input">
    ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" value="${n}" id="r${form}${id}-${n}" required><label for="r${form}${id}-${n}"><span aria-hidden="true">★</span><span class="sr">${n} baho</span></label>`).join('')}
  </div></fieldset>
  <button class="btn" type="submit">${button}</button>
  <p class="form-error" role="alert"></p>
</form>`;

function shiftAction(s) {
  if (s.my_status) return `<p class="chip chip-${s.my_status}">${STATUS[s.my_status]}</p>`;
  if (s.taken >= s.slots) return '<p class="chip">Joy qolmadi</p>';
  if (!me) return '<a class="btn" href="#/kirish">Ariza berish uchun kiring</a>';
  if (me.role !== 'worker') return '';
  return `<button class="btn" data-act="apply" data-id="${s.id}"${me.blocked ? ' disabled' : ''}>Ariza berish</button>`;
}

function applicationAside(a) {
  const today = tashkentDate();
  let html = `<p class="chip chip-${a.status}">${STATUS[a.status]}</p>`;
  if (a.phone) html += `<p class="contact">Ish beruvchi: ${tel(a.phone)}</p>`;
  if (a.status === 'accepted' && a.date === today) html += '<p class="hint">Bugun bekor qilib bo‘lmaydi. Kelmasangiz, hisobingiz bloklanadi.</p>';
  if (a.status === 'pending' || (a.status === 'accepted' && a.date > today)) {
    html += `<button class="btn btn-ghost" data-act="cancel" data-id="${a.id}">Arizani bekor qilish</button>`;
  }
  if (a.status === 'came' && !a.business_rating) html += starsForm('rate', a.id, 'Ish beruvchini baholang', 'Baholash');
  return html;
}

function applicant(a, shift) {
  let actions = '';
  if (a.status === 'pending') {
    actions = `<button class="btn" data-act="accept" data-id="${a.id}">Qabul qilish</button>
      <button class="btn btn-ghost" data-act="reject" data-id="${a.id}">Rad etish</button>`;
  } else if (a.status === 'accepted') {
    actions = shift.date <= tashkentDate()
      ? `${starsForm('came', a.id, 'Keldi. Ishini baholang', 'Keldi deb belgilash')}<button class="btn btn-danger" data-act="noshow" data-id="${a.id}">Kelmadi</button>`
      : '<p class="hint">Kelgan-kelmaganini smena kuni belgilaysiz.</p>';
  } else if (a.worker_rating) {
    actions = `<p class="hint">Siz bergan baho: <span class="stars">★ ${a.worker_rating}</span></p>`;
  }
  return `<li class="person">
    <div class="person-head">
      <div>
        <strong>${esc(a.name)}</strong>${a.blocked ? ' <span class="chip chip-noshow">Bloklangan</span>' : ''}
        <p class="muted">${a.rating ? `★ ${a.rating}, ` : 'Yangi ishchi, '}${a.done} ta smena bajargan</p>
        ${a.phone ? `<p>${tel(a.phone)}</p>` : ''}
      </div>
      <p class="chip chip-${a.status}">${STATUS[a.status]}</p>
    </div>
    ${actions && `<div class="actions">${actions}</div>`}
  </li>`;
}

// --- Sahifalar ---

const VIEWS = {
  async smenalar() {
    const list = await api('/shifts');
    return `<h1 tabindex="-1">Ochiq smenalar</h1>
      ${blockedBanner()}
      ${list.length
        ? `<div class="tickets">${list.map((s) => ticket(s, shiftAction(s))).join('')}</div>`
        : empty('Hozircha ochiq smena yo‘q', 'Yangi smenalar har kuni qo‘shiladi. Kechroq qaytib ko‘ring.')}`;
  },

  async arizalarim() {
    if (!guard('worker')) return;
    const list = await api('/my/applications');
    const stats = me.done ? `${me.rating ? `Reytingingiz ★ ${me.rating}. ` : ''}${me.done} ta smena bajargansiz.` : 'Birinchi smenangizdan keyin bu yerda reytingingiz chiqadi.';
    return `<h1 tabindex="-1">Arizalarim</h1>
      <p class="lead">${stats}</p>
      ${blockedBanner()}
      ${list.length
        ? `<div class="tickets">${list.map((a) => ticket(a, applicationAside(a))).join('')}</div>`
        : empty('Hali ariza bermagansiz', '<a href="#/smenalar">Ochiq smenalarni ko‘ring</a> va birinchisini tanlang.')}`;
  },

  async biznes() {
    if (!guard('business')) return;
    const list = await api('/my/shifts');
    return `<div class="head"><h1 tabindex="-1">Smenalarim</h1><a class="btn" href="#/yangi">Yangi smena</a></div>
      ${me.rating ? `<p class="lead">Ishchilar bergan baho: <span class="stars">★ ${me.rating}</span></p>` : ''}
      ${list.length
        ? `<div class="tickets">${list.map((s) => ticket(s, `<a class="btn btn-ghost" href="#/smena/${s.id}">Arizalar${s.pending ? ` (${s.pending} ta yangi)` : ''}</a>`)).join('')}</div>`
        : empty('Hali smena e’lon qilmagansiz', 'Sana, vaqt va haqni yozing: ishchilar ariza beradi, siz tanlaysiz. <a href="#/yangi">Birinchi smenani e’lon qiling</a>.')}`;
  },

  async smena(id) {
    if (!guard('business')) return;
    const { shift, applicants } = await api(`/shifts/${Number(id)}`);
    return `<a class="back" href="#/biznes">Smenalarim</a>
      <h1 tabindex="-1">${esc(shift.title)}</h1>
      <div class="tickets">${ticket(shift)}</div>
      <h2 style="margin-top:32px">Arizalar</h2>
      ${applicants.length
        ? `<ul class="people">${applicants.map((a) => applicant(a, shift)).join('')}</ul>`
        : empty('Hali ariza yo‘q', 'Ishchilar ariza bersa, shu yerda ko‘rasiz va qabul qilasiz.')}`;
  },

  yangi() {
    if (!guard('business')) return;
    const today = tashkentDate();
    return `<h1 tabindex="-1">Yangi smena</h1>
      <form class="form" data-form="shift">
        ${field('Lavozim', '<input name="title" required maxlength="80" placeholder="Ofitsiant">')}
        ${field('Manzil', '<input name="place" required maxlength="120" placeholder="Yunusobod, 4-mavze, Bahor to‘yxonasi">')}
        <div class="row">
          ${field('Sana', `<input type="date" name="date" required min="${today}" value="${today}">`)}
          ${field('Boshlanishi', '<input type="time" name="start" required value="18:00">')}
          ${field('Tugashi', '<input type="time" name="end" required value="23:00">')}
        </div>
        <div class="row">
          ${field('Haq, so‘m', '<input type="number" name="pay" required min="10000" max="5000000" step="1000" inputmode="numeric" placeholder="250000">')}
          ${field('Necha kishi kerak', '<input type="number" name="slots" required min="1" max="50" value="1" inputmode="numeric">')}
        </div>
        ${field('Izoh (ixtiyoriy)', '<textarea name="note" maxlength="500" rows="3" placeholder="Kiyim: oq ko‘ylak, qora shim. Ovqat beriladi."></textarea>')}
        <button class="btn btn-lg" type="submit">Smenani e’lon qilish</button>
        <p class="form-error" role="alert"></p>
      </form>`;
  },

  kirish() {
    if (me) return go(home());
    return `<h1 tabindex="-1">Kirish</h1>
      <form class="form narrow" data-form="login">
        ${field('Telefon raqam', phoneInput())}
        ${field('Parol', '<input type="password" name="password" required autocomplete="current-password">')}
        <button class="btn btn-lg" type="submit">Kirish</button>
        <p class="form-error" role="alert"></p>
        <p>Hisobingiz yo‘qmi? <a href="#/royxat">Ro‘yxatdan o‘ting</a></p>
      </form>`;
  },

  royxat(_, query) {
    if (me) return go(home());
    const biz = query.get('rol') === 'biznes';
    return `<h1 tabindex="-1">Ro‘yxatdan o‘tish</h1>
      <form class="form narrow" data-form="register">
        <fieldset class="roles">
          <legend>Siz kimsiz?</legend>
          <label><input type="radio" name="role" value="worker"${biz ? '' : ' checked'}><span>Ish qidiryapman</span></label>
          <label><input type="radio" name="role" value="business"${biz ? ' checked' : ''}><span>Menga ishchi kerak</span></label>
        </fieldset>
        ${field('Ismingiz', '<input name="name" required maxlength="60" autocomplete="name">')}
        ${field('Biznes nomi', '<input name="org" maxlength="80" placeholder="Bahor to‘yxonasi">', 'org')}
        ${field('Telefon raqam', phoneInput())}
        ${field('Parol', '<input type="password" name="password" required minlength="6" autocomplete="new-password">')}
        <button class="btn btn-lg" type="submit">Ro‘yxatdan o‘tish</button>
        <p class="form-error" role="alert"></p>
        <p>Hisobingiz bormi? <a href="#/kirish">Kiring</a></p>
      </form>`;
  },
};

const FORMS = {
  async login(body) { me = await api('/login', body); go(home()); },
  async register(body) { me = await api('/register', body); go(home()); },
  async shift(body) { await api('/shifts', body); toast('Smena e’lon qilindi'); go('#/biznes'); },
  async rate(body, id) { await api(`/applications/${id}/rate`, body); toast('Baho saqlandi'); render(); },
  async came(body, id) { await api(`/applications/${id}`, { action: 'came', rating: body.rating }); toast('Keldi deb belgilandi'); render(); },
};

function renderHeader() {
  const links = !me ? [['#/smenalar', 'Smenalar'], ['#/kirish', 'Kirish']]
    : me.role === 'worker' ? [['#/smenalar', 'Smenalar'], ['#/arizalarim', 'Arizalarim']]
    : [['#/biznes', 'Smenalarim'], ['#/yangi', 'Yangi smena']];
  header.innerHTML = `<a class="logo" href="/">Smena</a>
    <nav>
      ${links.map(([href, text]) => `<a href="${href}"${location.hash.startsWith(href) ? ' aria-current="page"' : ''}>${text}</a>`).join('')}
      ${installEvt ? '<button class="link" data-act="install">Ilovani o‘rnatish</button>' : ''}
      ${me ? '<button class="link" data-act="logout">Chiqish</button>' : ''}
    </nav>`;
}

async function render(moveFocus = false) {
  const [route, query = ''] = location.hash.slice(2).split('?');
  const [name, id] = route.split('/');
  if (!VIEWS[name]) return go(home());
  if (me) me = await api('/me').catch(() => me);
  renderHeader();
  try {
    const html = await VIEWS[name](id, new URLSearchParams(query));
    if (html === undefined) return;
    main.innerHTML = html;
    if (moveFocus) main.querySelector('h1')?.focus();
  } catch (err) {
    main.innerHTML = `<p class="banner danger">${esc(err.message)}</p>`;
  }
}

document.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-act]');
  if (!button) return;
  const { act, id } = button.dataset;
  if (act === 'install') {
    installEvt.prompt();
    installEvt = null;
    return renderHeader();
  }
  if (act === 'noshow' && !confirm('Ishchi “kelmadi” deb belgilanadi va hisobi bloklanadi. Davom etasizmi?')) return;
  button.disabled = true;
  try {
    if (act === 'logout') {
      await api('/logout', {});
      me = null;
      return go('#/smenalar');
    }
    if (act === 'apply') await api(`/shifts/${id}/apply`, {});
    else if (act === 'cancel') await api(`/applications/${id}/cancel`, {});
    else await api(`/applications/${id}`, { action: act });
    toast(DONE[act]);
    render();
  } catch (err) {
    toast(err.message, true);
    button.disabled = false;
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target;
  const handler = FORMS[form.dataset.form];
  if (!handler) return;
  e.preventDefault();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await handler(Object.fromEntries(new FormData(form)), form.dataset.id);
  } catch (err) {
    form.querySelector('.form-error').textContent = err.message;
    button.disabled = false;
  }
});

addEventListener('hashchange', () => render(true));
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  renderHeader();
});
addEventListener('appinstalled', () => { installEvt = null; renderHeader(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
api('/me').then((u) => { me = u; }).catch(() => {}).finally(() => render());
