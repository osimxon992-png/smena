'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useT } from '@/components/Lang';

type Who = 'all' | 'worker' | 'business';
type Item = { q: string; a: React.ReactNode; plain?: string; who: Who };
type TFn = ReturnType<typeof useT>['t'];

const faq = (t: TFn): Item[] => [
  { who: 'worker', q: t('Ishchilar uchun pullimi?'), a: t('Ro‘yxatdan o‘tish va ariza berish bepul. Smena bajarilgach, topgan haqingizning 15% i Smena ulushi: masalan, 200 000 so‘mdan 30 000 so‘m, qo‘lingizga 170 000 so‘m qoladi. Kelmagan yoki bekor qilingan smenadan hech narsa olinmaydi.') },
  { who: 'all', q: t('Haqni kim va qachon to‘laydi?'), a: t('Haqni ish beruvchi to‘laydi. To‘lov tartibini qabul qilingandan keyin telefon orqali kelishib olasiz.') },
  { who: 'worker', q: t('Bora olmasam nima bo‘ladi?'), a: t('Smenadan kamida bir kun oldin arizani bekor qiling: bu bepul va reytingingizga ta’sir qilmaydi. Smena kuni bekor qilib bo‘lmaydi, qabul qilingan smenaga kelmasangiz hisobingiz bloklanadi.') },
  { who: 'worker', q: t('Telefon raqamimni kim ko‘radi?'), a: t('Faqat sizni smenaga qabul qilgan ish beruvchi. Ariza bosqichida raqamingiz yashirin turadi.') },
  { who: 'all', q: t('Telegram’da qanday xabarlar keladi?'), a: t('Kirish kodlari, yangi ariza, qabul yoki rad, smenadan bir kun va 3 soat oldin eslatma, sevimli biznesning yangi smenasi va takliflar. Eslatmadagi “Kelaman” yoki “Kela olmayman” tugmasi ish beruvchiga darhol xabar beradi. Xabarlar sayt tilida keladi.') },
  { who: 'worker', q: t('“Keldim” tugmasi nima uchun?'), a: t('Smena joyiga yetib kelgach, ilovadagi “Arizalarim” sahifasida “Keldim” ni bosasiz. Tugma smena boshlanishidan bir soat oldin ochiladi. Ish beruvchi kelganingizni darhol ko‘radi, bu esa kelish foizingiz va reytingingizni oshiradi.') },
  { who: 'worker', q: t('Kelish foizi va belgilar nima?'), a: t('Kelish foizi — qabul qilingan smenalaringizning nechtasiga kelganingiz. 5 ta smenadan keyin birorta ham qoldirmasangiz “Ishonchli”, 10 ta smena va 4.8 dan yuqori baho bilan “Top ishchi” belgisini olasiz. Ish beruvchilar arizangizda shuni ko‘radi.') },
  {
    who: 'business', q: t('Biznes sifatida qancha to‘layman?'),
    a: <>{t('Smena e’lon qilish va ishchi tanlash bepul: siz faqat ishchilarga kelishilgan haqni to‘laysiz. Smena ulushini (15%) ishchi o‘z haqidan to‘laydi.')} <Link href="/bizneslar#hisob">{t('Hisob-kitobni bizneslar sahifasida ko‘ring.')}</Link></>,
    plain: `${t('Smena e’lon qilish va ishchi tanlash bepul: siz faqat ishchilarga kelishilgan haqni to‘laysiz. Smena ulushini (15%) ishchi o‘z haqidan to‘laydi.')} ${t('Hisob-kitobni bizneslar sahifasida ko‘ring.')} komissiya`,
  },
  { who: 'business', q: t('Bitta smenaga necha kishi olsa bo‘ladi?'), a: t('Bitta e’londa 1 dan 50 kishigacha. Joylar to‘lgach, e’lon ro‘yxatda “Joy qolmadi” bo‘lib turadi.') },
  { who: 'business', q: t('Har hafta bir xil smena kerak bo‘lsa-chi?'), a: t('Smena e’lon qilishda “Takrorlash”ni tanlang: har kuni yoki har hafta, jami 12 tagacha smena bir martada ochiladi. Eski smenani “Nusxa olish” tugmasi bilan ham tez e’lon qilasiz.') },
  { who: 'business', q: t('Sevimli ishchilar nima beradi?'), a: t('Yaxshi ishlagan ishchini arizalar ro‘yxatida ☆ bilan belgilang. Yangi smena e’lon qilsangiz, sevimlilaringizga birinchi bo‘lib Telegram’da xabar boradi; “Sevimli ishchilar” sahifasidan ularni aniq smenaga taklif ham qilasiz.') },
  {
    who: 'all', q: t('Ilovani qanday o‘rnataman?'),
    a: <>{t('Do‘kondan yuklab olish shart emas: saytni telefon brauzerida oching va “Bosh ekranga qo‘shish”ni tanlang.')} <Link href="/qanday-ishlaydi#ornatish">{t('Batafsil bu yerda.')}</Link></>,
    plain: `${t('Do‘kondan yuklab olish shart emas: saytni telefon brauzerida oching va “Bosh ekranga qo‘shish”ni tanlang.')} telefon`,
  },
];

const WHO: [Who, string][] = [['all', 'Hammasi'], ['worker', 'Ishchilarga'], ['business', 'Bizneslarga']];
// Apostrof turlari (‘ ’ ' `) farq qilmasin: "bo'lsa" va "bo‘lsa" bir xil topiladi
const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ'`]/g, '');

// Savollar ro'yxati va o'ngdagi qidiruv paneli: so'z bo'yicha qidirish, kimga tegishliligi bo'yicha saralash, hammasini ochish
export default function FaqBrowser() {
  const [query, setQuery] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { t } = useT();
  const FAQ = faq(t);

  // Bosh sahifadagi "Javob topish" dan kelgan ?q=
  useEffect(() => { setQuery(new URLSearchParams(location.search).get('q') ?? ''); }, []);

  const words = norm(query).split(/\s+/).filter(Boolean);
  const shown = FAQ.filter((f) => (who === 'all' || f.who === who || f.who === 'all')
    && words.every((w) => norm(`${f.q} ${f.plain ?? f.a}`).includes(w)));
  const allOpen = shown.length > 0 && shown.every((f) => open.has(f.q));
  const toggle = (q: string, isOpen: boolean) => setOpen((s) => {
    if (s.has(q) === isOpen) return s;
    const next = new Set(s);
    if (isOpen) next.add(q); else next.delete(q);
    return next;
  });

  return (
    <section className="section faq wrap" aria-label={t('Savol va javoblar')}>
      <div className="faq-layout">
        <div className="faq-list">
          {shown.map((f) => (
            <details key={f.q} open={open.has(f.q)} onToggle={(e) => toggle(f.q, e.currentTarget.open)}>
              <summary>{f.q}</summary><p>{f.a}</p>
            </details>
          ))}
          {!shown.length && <p className="empty">{t('Bunday savol topilmadi. Boshqa so‘z bilan qidiring yoki filtrni “Hammasi”ga qaytaring.')}</p>}
        </div>
        <aside className="faq-aside widget sheet taped">
          <h2 className="widget-title">{t('Savolingizni toping')}</h2>
          <label className="sr" htmlFor="faq-q">{t('Savollar ichidan qidirish')}</label>
          <input id="faq-q" className="search-input" type="search" placeholder={t('Masalan: telefon, bekor, 15%')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <p className="widget-q">{t('Kim uchun?')}</p>
          <div className="pick-row" role="group" aria-label={t('Kim uchun?')}>
            {WHO.map(([k, label]) => (
              <button key={k} type="button" className="pick" aria-pressed={k === who} onClick={() => setWho(k)}>{t(label)}</button>
            ))}
          </div>
          <div className="faq-aside-foot">
            <span aria-live="polite">{t('{n} ta savol', { n: shown.length })}</span>
            <button type="button" className="btn btn-line" disabled={!shown.length}
              onClick={() => setOpen(allOpen ? new Set() : new Set(shown.map((f) => f.q)))}>
              {allOpen ? t('Hammasini yopish') : t('Hammasini ochish')}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
