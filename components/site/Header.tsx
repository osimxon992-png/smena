'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['/qanday-ishlaydi', 'Qanday ishlaydi'],
  ['/qoidalar', 'Qoidalar'],
  ['/bizneslar', 'Bizneslar uchun'],
  ['/savollar', 'Savollar'],
];

export default function Header() {
  const path = usePathname();
  return (
    <>
      <a className="skip" href="#asosiy">Asosiy qismga o‘tish</a>
      <header className="nav wrap">
        <Link className="logo" href="/">Smena</Link>
        <nav aria-label="Sahifalar">
          {LINKS.map(([href, text]) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{text}</Link>
          ))}
        </nav>
        <div className="nav-act">
          <Link className="link-ink" href="/ilova/kirish">Kirish</Link>
          <Link className="btn" href="/ilova/royxat">Ro‘yxatdan o‘tish</Link>
        </div>
      </header>
    </>
  );
}
