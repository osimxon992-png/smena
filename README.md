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

## Imkoniyatlar

- **Telegram bildirishnomalari** (@smenauzbbot): yangi ariza (biznesga), qabul yoki rad (ishchiga), bekor qilish, “Keldim”, sevimli biznesning yangi smenasi va takliflar. Xabar foydalanuvchining raqami botga bog‘langan chatga, uning tilida boradi.
- **Eslatmalar**: qabul qilingan ishchiga smenadan bir kun oldin (kechqurun 18:00 dan) va 3 soat oldin “✅ Kelaman / ❌ Kela olmayman” tugmalari bilan. Ertangi smenada “Kela olmayman” arizani bepul bekor qiladi; smena kuni biznesga xabar boradi va u ishchini ilovada ozod qiladi (bloklanmaydi). Eslatmalar saytga kelgan istalgan so‘rovdan keyin yuboriladi (daqiqada bir martadan ko‘p emas). Sayt jim turganda ham o‘z vaqtida ketishi uchun `GET /api/cron/reminders` ni har 10–15 daqiqada chaqiradigan tashqi cron qo‘shing (masalan cron-job.org yoki GitHub Actions).
- **“Keldim”**: ishchi smena boshlanishidan 1 soat oldindan tugaguncha bosadi, biznes darhol ko‘radi.
- **Ishonch ko‘rsatkichlari**: kelish foizi, bajargan va kelmagan smenalar, “Keldim” soni, belgilar (Yangi / Ishonchli / Top ishchi). Biznes uchun — smenalarida bajarilgan ishlar soni.
- **Filtr va qidiruv**: `/api/shifts?q=&when=today|tomorrow|week|YYYY-MM-DD&min_pay=&region=&district=&mine=1&sort=pay`.
- **Takroriy smenalar** (har kuni / har hafta, 12 tagacha) va “Nusxa olish”.
- **Sevimli ishchilar**: arizalarda ☆, `/ilova/sevimlilar` sahifasi, yangi smenada ularga xabar, aniq smenaga taklif.
- **Tillar**: o‘zbek, rus, ingliz. Tanlov `lang` cookie’sida va kirgan foydalanuvchida bazada. Matnlar: `lib/ui.ts` (sayt va ilova), `lib/messages.ts` (server xatolari va bot). Kalit — o‘zbekcha matnning o‘zi: tarjima bo‘lmasa o‘zbekchasi chiqadi. Admin paneli o‘zbekcha.

Telegram webhook eslatma tugmalarini (`callback_query`) ham qabul qilishi kerak: deploydan keyin admin panelida botni bir marta qayta ulang (“Ulash”).

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
