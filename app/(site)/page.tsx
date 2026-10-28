import Link from 'next/link';
import DayPicker from '@/components/site/DayPicker';
import HangingTags from '@/components/site/HangingTags';
import QuickAsk from '@/components/site/QuickAsk';
import ShiftTypes from '@/components/site/ShiftTypes';
import Wipe from '@/components/site/Wipe';

const MORE = [
  ['/qanday-ishlaydi', 'Qanday ishlaydi', 'Arizadan bahogacha to‘rt qadam va ilovani telefonga o‘rnatish.', 'paper'],
  ['/qoidalar', 'Qoidalar', 'Kelmagan bloklanadi, bir kun oldin bekor qilish esa bepul.', 'teal'],
  ['/bizneslar', 'Bizneslar uchun', 'Smena e’lon qilish va komissiya hisob-kitobi: faqat kelganlar uchun 15%.', 'ink'],
  ['/savollar', 'Savollar', 'To‘lov, bekor qilish va telefon raqami haqida qisqa javoblar.', 'kraft'],
];

export default function Home() {
  return (
    <>
      <section className="board" aria-labelledby="hero-title">
        <div className="board-top wrap">
          <h1 id="hero-title" className="hero-title"><span>Bugungi smenalar.</span> <span>Haqi ochiq yozilgan.</span></h1>
          <div className="note taped">
            <p>To‘yxona, restoran, ombor va topshirish punktlarida bir kunlik ish. Vaqti, joyi va haqi oldindan yozilgan: tanlaysiz, ariza berasiz, qabul qilinsangiz borasiz.</p>
            <div className="actions">
              <Link className="btn btn-red btn-lg" href="/ilova/smenalar">Barcha smenalar</Link>
              <Link className="btn btn-line btn-lg" href="/ilova/royxat?rol=biznes">Menga ishchi kerak</Link>
            </div>
          </div>
        </div>
        <HangingTags />
      </section>

      <ShiftTypes />

      <section className="section wrap" aria-labelledby="more-title">
        <div className="section-head">
          <Wipe id="more-title">Batafsil o‘qing</Wipe>
          <QuickAsk />
        </div>
        <div className="more-grid">
          {MORE.map(([href, title, text, tone]) => (
            <Link key={href} className={`more-sign stall-${tone}`} href={href}>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="more-go">Sahifani ochish</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section final wrap" aria-labelledby="final-title">
        <div className="final-grid">
          <div>
            <h2 id="final-title" className="final-title">Ertaga bo‘shmisiz?</h2>
            <p className="lead">Bo‘sh kuningizni tanlang va o‘sha kuni qanday smenalar borligini ko‘ring. Ro‘yxatdan o‘tish ikki daqiqa oladi.</p>
            <div className="actions">
              <Link className="btn btn-red btn-lg" href="/ilova/smenalar">Smenalarni ko‘rish</Link>
              <Link className="btn btn-line btn-lg" href="/ilova/royxat?rol=biznes">Menga ishchi kerak</Link>
            </div>
          </div>
          <DayPicker />
        </div>
      </section>
    </>
  );
}
