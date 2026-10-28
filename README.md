# Smena

Bir kunlik smenalar: biznes smena e’lon qiladi, ishchilar ariza beradi, biznes tanlaydi. Qabul qilingan smenaga kelmagan ishchi bloklanadi.

Next.js (App Router, TypeScript) + SQLite (`node:sqlite`). Node 22.18+ kerak.

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
- Ma’lumotlar `smena.db` faylida. Toza boshlash uchun serverni to‘xtatib, faylni o‘chiring.
- PWA (telefonga o‘rnatish) faqat `npm run build && npm start` bilan va HTTPS’da ishlaydi; localhost bundan mustasno.
- `eski-versiya/` — oldingi oddiy HTML versiya, kerak bo‘lmasa o‘chirib tashlang.
