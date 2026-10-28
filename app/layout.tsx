import type { Metadata, Viewport } from 'next';
import { Onest, Permanent_Marker } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const body = Onest({ subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body' });
const marker = Permanent_Marker({ subsets: ['latin'], weight: '400', variable: '--font-marker' });

export const metadata: Metadata = {
  title: { default: 'Smena: bir kunlik ish Toshkentda', template: '%s: Smena' },
  description: 'To‘yxona, restoran, ombor va topshirish punktlarida bir kunlik smenalar. Haqi oldindan yozilgan, kelmagan ishchi bloklanadi.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = { themeColor: '#C99A5B', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${body.variable} ${marker.variable}`}>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
