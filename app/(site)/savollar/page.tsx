import type { Metadata } from 'next';
import FaqBrowser from '@/components/site/FaqBrowser';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';
import { getT } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('Savollar'),
    description: t('Smena haqida ko‘p so‘raladigan savollar: to‘lov, bekor qilish, telefon raqami va komissiya.'),
  };
}

export default async function Questions() {
  const { t } = await getT();
  return (
    <>
      <PageHead title={t('Savollar')} lead={t('Ishchilar va bizneslar eng ko‘p so‘raydigan narsalar. O‘ngdagi paneldan so‘z bo‘yicha qidiring yoki faqat o‘zingizga tegishlilarini qoldiring.')} />
      <FaqBrowser />
      <NextSign href="/ilova/smenalar" label={t('Tayyormisiz?')} title={t('Smenalarni ko‘rish')} tone="teal" />
    </>
  );
}
