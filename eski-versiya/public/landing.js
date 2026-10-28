// Sayt sahifalari: har bir blok faqat o'z elementi bor sahifada ishlaydi.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const som = (n) => `${Number(n).toLocaleString('ru-RU')} so‘m`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// --- Menyuda joriy sahifa ---
document.querySelectorAll('.nav nav a').forEach((a) => {
  if (a.pathname === location.pathname) a.setAttribute('aria-current', 'page');
});

// --- Sarlavhalar marker bilan "yoziladi" ---
const wipes = document.querySelectorAll('.wipe');
if (calm || !('IntersectionObserver' in window)) {
  wipes.forEach((el) => el.classList.add('in'));
} else {
  // Kesilgan (clip-path) element o'zi kuzatilmaydi: Chrome uni ko'rinmas deb hisoblaydi, shuning uchun ota-elementi kuzatiladi
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.querySelector(':scope > .wipe').classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -30% 0px' });
  wipes.forEach((el) => io.observe(el.parentElement));
}

// --- Bosh sahifa: ipdagi yorliqlar (jonli smenalar + aylantirishda tebranish) ---
const tagList = document.querySelector('[data-tags]');
let hangs = [...document.querySelectorAll('.hang')];
if (tagList) {
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const tashkent = (plus = 0) => new Date(Date.now() + plus * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
  const day = (iso) => {
    if (iso === tashkent()) return 'Bugun';
    if (iso === tashkent(1)) return 'Ertaga';
    const d = new Date(`${iso}T00:00:00Z`);
    return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
  };
  const HANG = [[0.1, 28], [0.3, 44], [0.5, 22], [0.7, 40], [0.9, 26]];
  const samples = [...tagList.querySelectorAll('.tag')].map((t) => t.outerHTML);

  fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list) => {
    const open = list.filter((s) => s.taken < s.slots).slice(0, 5);
    if (!open.length) return;
    const live = open.map((s) => `<article class="tag">
      <p class="tag-role">${esc(s.title)}</p>
      <p class="tag-pay">${Number(s.pay).toLocaleString('ru-RU')} <small>so‘m</small></p>
      <p class="tag-place">${esc(s.org)}, ${esc(s.place)}</p>
      <p class="tag-when">${day(s.date)}, ${esc(s.start_time)}–${esc(s.end_time)}</p>
      <p class="tag-left">${s.slots - s.taken} joy qoldi</p>
      <a class="tag-act" href="/app.html#/smenalar">Ariza berish</a>
    </article>`);
    // Jonli smena kam bo'lsa, ip bo'sh qolmasin: qolgan joylar "Namuna" muhri bilan
    const filler = samples.slice(open.length).map((h) => h.replace('</article>', '<span class="tag-sample">Namuna</span></article>'));
    tagList.innerHTML = live.concat(filler)
      .map((tag, i) => `<li class="hang" style="--p:${HANG[i][0]};--len:${HANG[i][1]}px">${tag}</li>`).join('');
    document.querySelector('[data-tags-label]').innerHTML = (open.length === 5 ? 'Hozir ochiq smenalar.' : `Birinchi ${open.length} tasi hozir ochiq, qolganlari namuna.`)
      + ' Hammasi <a href="/app.html#/smenalar">ilovada</a>.';
    hangs = [...document.querySelectorAll('.hang')];
  });
}

// Yorliqlar aylantirish tezligiga qarab tebranadi (so'nuvchi prujina)
let angle = 0;
let speed = 0;
let spinning = false;
function swing() {
  speed += -angle * 0.06;
  speed *= 0.9;
  angle += speed;
  hangs.forEach((h, i) => h.style.setProperty('--swing', `${(angle * (i % 2 ? 0.8 : 1.15)).toFixed(2)}deg`));
  if (Math.abs(angle) > 0.02 || Math.abs(speed) > 0.02) requestAnimationFrame(swing);
  else spinning = false;
}

// --- Bosh sahifa: katta ekranda vertikal aylantirish peshtaxtalarni yonga suradi ---
const rows = document.querySelector('[data-hscroll]');
const track = rows?.querySelector('[data-track]');
const wide = matchMedia('(min-width: 900px)');
function layoutRows() {
  if (!rows) return;
  const on = wide.matches && !calm;
  rows.classList.toggle('pinned', on);
  rows.style.height = on ? `${track.scrollWidth - innerWidth + innerHeight}px` : '';
  track.style.transform = '';
  moveRows();
}
function moveRows() {
  if (!rows?.classList.contains('pinned')) return;
  const travel = rows.offsetHeight - innerHeight;
  const done = Math.min(1, Math.max(0, (scrollY - rows.offsetTop) / travel));
  track.style.transform = `translateX(${-done * (track.scrollWidth - innerWidth)}px)`;
}

// --- Qanday ishlaydi: qadam ko'ringanda yorliqqa muhr tushadi ---
const storyTag = document.querySelector('[data-story-tag]');
if (storyTag) {
  const phone = storyTag.querySelector('[data-phone]');
  const stampTo = (state) => {
    storyTag.dataset.state = state;
    storyTag.querySelectorAll('.stamp').forEach((s, i) => s.classList.toggle('on', i < state));
    phone.textContent = state >= 2 ? '+998 90 123 45 67' : 'qabuldan keyin ochiladi';
  };
  if ('IntersectionObserver' in window) {
    const steps = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) stampTo(Number(e.target.dataset.step));
    }), { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('[data-step]').forEach((el) => steps.observe(el));
  } else {
    stampTo(4);
  }
}

// --- Bizneslar: komissiya kelgan ishchilar haqining 15% i ---
const calc = document.querySelector('[data-calc]');
if (calc) {
  const recount = () => {
    const pay = Number(calc.pay.value);
    const n = Number(calc.n.value);
    const out = (k, v) => { calc.querySelector(`[data-out="${k}"]`).textContent = v; };
    out('pay', som(pay));
    out('n', `${n} kishi`);
    out('wages', som(pay * n));
    out('fee', som(Math.round(pay * n * 0.15)));
  };
  calc.addEventListener('input', recount);
  calc.addEventListener('submit', (e) => e.preventDefault());
  recount();
}

// --- PWA o'rnatish tugmasi ---
const installBtn = document.querySelector('[data-install]');
if (installBtn) {
  let installEvt = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', () => { installEvt?.prompt(); installEvt = null; installBtn.hidden = true; });
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (!calm && hangs.length) {
    speed += Math.max(-1.5, Math.min(1.5, (y - lastY) * 0.03));
    if (!spinning) { spinning = true; requestAnimationFrame(swing); }
  }
  lastY = y;
  moveRows();
}, { passive: true });
addEventListener('resize', layoutRows);
wide.addEventListener('change', layoutRows);
document.fonts?.ready.then(layoutRows);
layoutRows();
