import type { Metadata } from 'next';
import InstallButton from '@/components/InstallButton';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';
import RoleSwitch from '@/components/site/RoleSwitch';
import StoryStamps from '@/components/site/StoryStamps';
import Wipe from '@/components/site/Wipe';
import { getT } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('Qanday ishlaydi'),
    description: t('Smenada ariza berishdan bahogacha to‘rt qadam va ilovani telefonga o‘rnatish.'),
  };
}

export default async function HowItWorks() {
  const { t } = await getT();
  return (
    <>
      <PageHead title={t('Qanday ishlaydi')} lead={t('Smenani tanlaysiz, ariza berasiz, qabul qilinsangiz borasiz. Har bir qadam quyida bitta yorliq misolida ko‘rsatilgan.')}>
        <RoleSwitch />
      </PageHead>

      <section className="section story wrap" id="yol" aria-labelledby="story-title">
        <Wipe id="story-title">{t('Arizadan bahogacha')}</Wipe>
        <p className="lead">{t('Yorliqqa qarang: har bir qadamda unga yangi muhr tushadi.')}</p>
        <StoryStamps />
      </section>

      <section className="section wrap" id="ornatish" aria-labelledby="install-title">
        <div className="install-grid">
          <div className="sign sign-ink install-sign">
            <h2 id="install-title" className="h2">{t('Telefoningizga o‘rnating')}</h2>
            <p>{t('Smena bosh ekranda oddiy ilova kabi turadi va internet sust bo‘lsa ham ochiladi. Do‘kondan yuklab olish shart emas.')}</p>
            <InstallButton className="btn btn-paper btn-lg" />
          </div>
          <div className="install-how">
            <div className="sheet taped">
              <h3>Android</h3>
              <p>{t('Saytni Chrome’da oching, menyudan “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang.')}</p>
            </div>
            <div className="sheet">
              <h3>iPhone</h3>
              <p>{t('Saytni Safari’da oching, “Ulashish” tugmasini bosing va “Bosh ekranga qo‘shish”ni tanlang.')}</p>
            </div>
          </div>
        </div>
      </section>

      <NextSign href="/qoidalar" title={t('Qoidalar')} tone="teal" />
    </>
  );
}
