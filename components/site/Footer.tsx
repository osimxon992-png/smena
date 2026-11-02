import Link from 'next/link';
import { getT } from '@/lib/lang-server';

export default async function Footer() {
  const { t } = await getT();
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link className="logo" href="/">Smena</Link>
          <p>{t('Toshkentda bir kunlik smenalar. Haqi oldindan yozilgan, kelmagan ishchi bloklanadi.')}</p>
        </div>
        <nav aria-label={t('Ishchilarga')}>
          <h3>{t('Ishchilarga')}</h3>
          <Link href="/ilova/smenalar">{t('Ochiq smenalar')}</Link>
          <Link href="/ilova/royxat">{t('Ro‘yxatdan o‘tish')}</Link>
          <Link href="/qanday-ishlaydi">{t('Qanday ishlaydi')}</Link>
        </nav>
        <nav aria-label={t('Bizneslarga')}>
          <h3>{t('Bizneslarga')}</h3>
          <Link href="/ilova/royxat?rol=biznes">{t('Smena e’lon qilish')}</Link>
          <Link href="/bizneslar#hisob">{t('Narx va hisob-kitob')}</Link>
          <Link href="/ilova/kirish">{t('Kirish')}</Link>
        </nav>
        <nav aria-label={t('Yordam')}>
          <h3>{t('Yordam')}</h3>
          <Link href="/qoidalar">{t('Qoidalar')}</Link>
          <Link href="/savollar">{t('Savollar')}</Link>
          <Link href="/qanday-ishlaydi#ornatish">{t('Ilovani o‘rnatish')}</Link>
        </nav>
      </div>
      <div className="wrap footer-base"><span>© 2026 Smena</span><span>{t('Toshkent')}</span></div>
    </footer>
  );
}
