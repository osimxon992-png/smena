import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link className="logo" href="/">Smena</Link>
          <p>Toshkentda bir kunlik smenalar. Haqi oldindan yozilgan, kelmagan ishchi bloklanadi.</p>
        </div>
        <nav aria-label="Ishchilarga">
          <h3>Ishchilarga</h3>
          <Link href="/ilova/smenalar">Ochiq smenalar</Link>
          <Link href="/ilova/royxat">Ro‘yxatdan o‘tish</Link>
          <Link href="/qanday-ishlaydi">Qanday ishlaydi</Link>
        </nav>
        <nav aria-label="Bizneslarga">
          <h3>Bizneslarga</h3>
          <Link href="/ilova/royxat?rol=biznes">Smena e’lon qilish</Link>
          <Link href="/bizneslar#hisob">Narx va hisob-kitob</Link>
          <Link href="/ilova/kirish">Kirish</Link>
        </nav>
        <nav aria-label="Yordam">
          <h3>Yordam</h3>
          <Link href="/qoidalar">Qoidalar</Link>
          <Link href="/savollar">Savollar</Link>
          <Link href="/qanday-ishlaydi#ornatish">Ilovani o‘rnatish</Link>
        </nav>
      </div>
      <div className="wrap footer-base"><span>© 2026 Smena</span><span>Toshkent</span></div>
    </footer>
  );
}
