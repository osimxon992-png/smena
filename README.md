# Smena

Bir kunlik smenalar: biznes smena e’lon qiladi, ishchilar ariza beradi, biznes tanlaydi. Qabul qilingan smenaga kelmagan ishchi bloklanadi.

Next.js (App Router, TypeScript) + Turso / libSQL (SQLite bilan bir xil SQL). Node 22.18+ kerak.

```bash
npm install
```

```bash
npm run dev
```

Sayt: http://localhost:3000, ilova: http://localhost:3000/ilova

```bash
npm test
```

- `app/(site)` — sayt sahifalari, `app/ilova` — ilova, `app/api/[...path]` — backend.
- `lib/api.ts` — barcha API amallari va baza; `components/` — React komponentlar.
- Lokalda ma’lumotlar `smena.db` faylida (`TURSO_DATABASE_URL` bo‘sh bo‘lsa). Toza boshlash uchun serverni to‘xtatib, faylni o‘chiring.
- Jadvallar birinchi so‘rovda avtomatik yaratiladi.
- PWA (telefonga o‘rnatish) faqat `npm run build && npm start` bilan va HTTPS’da ishlaydi; localhost bundan mustasno.
- `eski-versiya/` — oldingi oddiy HTML versiya, deploy qilinmaydi; kerak bo‘lmasa o‘chirib tashlang.

## Admin paneli

`/admin` — barcha foydalanuvchilar, smenalar, arizalar, 15% komissiya hisobi; ishchini bloklash va blokdan chiqarish. Panel 30 soniyada o‘zi yangilanadi.

Kirish `ADMIN_PASSWORD` muhit o‘zgaruvchisi bilan (lokalda `.env.local`, Vercel’da *Environment Variables*). U o‘rnatilmagan bo‘lsa panel o‘chiq turadi. Parolni almashtirsangiz, ochiq admin sessiyalari bekor bo‘ladi.

## Vercel’ga chiqarish

`vercel.json` loyihani bitta `smena` servisi sifatida tasvirlaydi: hamma yo‘llar (`/`, `/ilova`, `/api`) shu servisga boradi.

1. **Turso bazasini yarating** (turso.tech, bir marta):

   ```bash
   turso db create smena
   ```

   ```bash
   turso db show smena --url
   ```

   ```bash
   turso db tokens create smena
   ```

2. **Vercel loyihasi:** GitHub’dagi repoyni Vercel’ga import qiling. *Settings → Environment Variables* bo‘limiga ikkita qiymat qo‘shing (Production va Preview):
   - `TURSO_DATABASE_URL` — 1-qadamdagi `libsql://...` manzil
   - `TURSO_AUTH_TOKEN` — 1-qadamdagi token
   - `ADMIN_PASSWORD` — admin paneli uchun uzun parol

3. **Deploy** qiling. Har bir `git push` yangi deployni boshlaydi.

Turso bazasi bilan lokal sinash uchun `.env.example` dan nusxa olib, `.env.local` faylini yarating. Bu fayl git’ga kirmaydi.
