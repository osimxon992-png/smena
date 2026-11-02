import type { Metadata } from 'next';
import Link from 'next/link';
import Calculator from '@/components/site/Calculator';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';
import QuickPost from '@/components/site/QuickPost';
import Wipe from '@/components/site/Wipe';
import { getT } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('Bizneslar uchun'),
    description: t('Bir kunlik smena e’lon qiling: biznes uchun bepul. Kimni olishni o‘zingiz tanlaysiz.'),
  };
}

export default async function Business() {
  const { t } = await getT();
  return (
    <>
      <PageHead title={t('Bizneslar uchun')} lead={t('To‘yxona, restoran, ombor yoki topshirish punkti: bir kunga qo‘shimcha odam kerak bo‘lsa, shu yerda e’lon qiling.')}>
        <QuickPost />
      </PageHead>

      <section className="section wrap" id="hisob" aria-labelledby="biz-title">
        <div className="biz-grid">
          <div>
            <Wipe id="biz-title">{t('Ertaga ishchi kerakmi?')}</Wipe>
            <p className="lead">{t('Smenani bir daqiqada e’lon qiling. Reytingi, kelish foizi va bajargan smenalari ko‘rinib turgan ishchilar ariza beradi, kimni olishni o‘zingiz tanlaysiz.')}</p>
            <ol className="biz-steps">
              <li>{t('Lavozim, sana, vaqt va haqni yozasiz. Har kuni yoki har hafta takrorlanadigan smenani bir martada e’lon qilasiz.')}</li>
              <li>{t('Arizalarni ko‘rib, kerakli odamlarni qabul qilasiz. Yaxshi ishlaganlarni sevimlilarga qo‘shasiz: keyingi smenada ularga birinchi bo‘lib xabar boradi.')}</li>
              <li>{t('Ishchilar Telegram’da eslatma oladi va kelishini tasdiqlaydi, joyiga kelganda “Keldim” bosadi. Siz kelganlarni belgilab baholaysiz. E’lon va tanlov bepul.')}</li>
            </ol>
            <Link className="btn btn-lg" href="/ilova/royxat?rol=biznes">{t('Smena e’lon qilish')}</Link>
          </div>
          <Calculator />
        </div>
      </section>

      <NextSign href="/savollar" title={t('Savollar')} tone="paper" />
    </>
  );
}
