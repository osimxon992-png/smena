import type { Metadata } from 'next';
import FaqBrowser from '@/components/site/FaqBrowser';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';

export const metadata: Metadata = {
  title: 'Savollar',
  description: 'Smena haqida ko‘p so‘raladigan savollar: to‘lov, bekor qilish, telefon raqami va komissiya.',
};

export default function Questions() {
  return (
    <>
      <PageHead title="Savollar" lead="Ishchilar va bizneslar eng ko‘p so‘raydigan narsalar. O‘ngdagi paneldan so‘z bo‘yicha qidiring yoki faqat o‘zingizga tegishlilarini qoldiring." />
      <FaqBrowser />
      <NextSign href="/ilova/smenalar" label="Tayyormisiz?" title="Smenalarni ko‘rish" tone="teal" />
    </>
  );
}
