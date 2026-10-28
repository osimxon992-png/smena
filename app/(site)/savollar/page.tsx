import type { Metadata } from 'next';
import Link from 'next/link';
import NextSign from '@/components/site/NextSign';

export const metadata: Metadata = {
  title: 'Savollar',
  description: 'Smena haqida ko‘p so‘raladigan savollar: to‘lov, bekor qilish, telefon raqami va komissiya.',
};

const FAQ: [string, React.ReactNode][] = [
  ['Ishchilar uchun pullimi?', 'Yo‘q. Ro‘yxatdan o‘tish, ariza berish va ishlash bepul. Komissiyani biznes to‘laydi.'],
  ['Haqni kim va qachon to‘laydi?', 'Haqni ish beruvchi to‘laydi. To‘lov tartibini qabul qilingandan keyin telefon orqali kelishib olasiz.'],
  ['Bora olmasam nima bo‘ladi?', 'Smenadan kamida bir kun oldin arizani bekor qiling: bu bepul va reytingingizga ta’sir qilmaydi. Smena kuni bekor qilib bo‘lmaydi, qabul qilingan smenaga kelmasangiz hisobingiz bloklanadi.'],
  ['Telefon raqamimni kim ko‘radi?', 'Faqat sizni smenaga qabul qilgan ish beruvchi. Ariza bosqichida raqamingiz yashirin turadi.'],
  ['Biznes sifatida qancha to‘layman?', <>Har bir kelgan ishchi haqining 15%. Ishchi kelmasa, hech narsa to‘lamaysiz. Hisob-kitobni <Link href="/bizneslar#hisob">bizneslar sahifasida</Link> ko‘ring.</>],
  ['Bitta smenaga necha kishi olsa bo‘ladi?', 'Bitta e’londa 1 dan 50 kishigacha. Joylar to‘lgach, e’lon ro‘yxatda “Joy qolmadi” bo‘lib turadi.'],
  ['Ilovani qanday o‘rnataman?', <>Do‘kondan yuklab olish shart emas: saytni telefon brauzerida oching va “Bosh ekranga qo‘shish”ni tanlang. Batafsil <Link href="/qanday-ishlaydi#ornatish">bu yerda</Link>.</>],
];

export default function Questions() {
  return (
    <>
      <header className="page-head wrap">
        <h1 className="page-title">Savollar</h1>
        <p className="lead">Ishchilar va bizneslar eng ko‘p so‘raydigan narsalar.</p>
      </header>

      <section className="section faq wrap" aria-label="Savol va javoblar">
        <div className="faq-list">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <NextSign href="/ilova/smenalar" label="Tayyormisiz?" title="Smenalarni ko‘rish" tone="teal" />
    </>
  );
}
