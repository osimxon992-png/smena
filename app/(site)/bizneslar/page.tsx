import type { Metadata } from 'next';
import Link from 'next/link';
import Calculator from '@/components/site/Calculator';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';
import QuickPost from '@/components/site/QuickPost';
import Wipe from '@/components/site/Wipe';

export const metadata: Metadata = {
  title: 'Bizneslar uchun',
  description: 'Bir kunlik smena e’lon qiling. Komissiya faqat kelgan ishchilar uchun, haqning 15%.',
};

export default function Business() {
  return (
    <>
      <PageHead title="Bizneslar uchun" lead="To‘yxona, restoran, ombor yoki topshirish punkti: bir kunga qo‘shimcha odam kerak bo‘lsa, shu yerda e’lon qiling.">
        <QuickPost />
      </PageHead>

      <section className="section wrap" id="hisob" aria-labelledby="biz-title">
        <div className="biz-grid">
          <div>
            <Wipe id="biz-title">Ertaga ishchi kerakmi?</Wipe>
            <p className="lead">Smenani bir daqiqada e’lon qiling. Reytingi va bajargan smenalari ko‘rinib turgan ishchilar ariza beradi, kimni olishni o‘zingiz tanlaysiz.</p>
            <ol className="biz-steps">
              <li>Lavozim, sana, vaqt va haqni yozasiz.</li>
              <li>Arizalarni ko‘rib, kerakli odamlarni qabul qilasiz.</li>
              <li>Smena kuni kelganlarni belgilaysiz. Komissiya faqat kelganlar uchun.</li>
            </ol>
            <Link className="btn btn-lg" href="/ilova/royxat?rol=biznes">Smena e’lon qilish</Link>
          </div>
          <Calculator />
        </div>
      </section>

      <NextSign href="/savollar" title="Savollar" tone="paper" />
    </>
  );
}
