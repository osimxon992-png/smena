import type { Metadata, Viewport } from 'next';
import { Onest, Permanent_Marker } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import { LangProvider } from '@/components/Lang';
import { getLang, getT } from '@/lib/lang-server';
import './globals.css';

const body = Onest({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body' });
const marker = Permanent_Marker({ subsets: ['latin'], weight: '400', variable: '--font-marker' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t('Smena: bir kunlik ish Toshkentda'), template: '%s: Smena' },
    description: t('To‘yxona, restoran, ombor va topshirish punktlarida bir kunlik smenalar. Haqi oldindan yozilgan, kelmagan ishchi bloklanadi.'),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon.svg', apple: '/icon-192.png' },
  };
}

export const viewport: Viewport = { themeColor: '#C99A5B', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Til "lang" cookie'sidan: sahifa birinchi chizilishidanoq tanlangan tilda keladi
  const lang = await getLang();
  return (
    <html lang={lang} className={`${body.variable} ${marker.variable}`}>
      <body>
        <SmoothScroll />
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
