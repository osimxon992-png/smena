'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type Me } from '@/lib/client';

const LINKS = [
  ['/qanday-ishlaydi', 'Qanday ishlaydi'],
  ['/qoidalar', 'Qoidalar'],
  ['/bizneslar', 'Bizneslar uchun'],
  ['/savollar', 'Savollar'],
];

export default function Header() {
  const path = usePathname();
  // undefined: hali bilinmaydi. Kirgan foydalanuvchiga "Kirish" o'rniga o'z sahifalari ko'rinadi
  const [me, setMe] = useState<Me | null>();
  useEffect(() => { api<Me | null>('/me').then(setMe, () => setMe(null)); }, []);
  const [first, second] = !me ? [['/ilova/kirish', 'Kirish'], ['/ilova/royxat', 'Ro‘yxatdan o‘tish']]
    : me.role === 'worker' ? [['/ilova/smenalar', 'Smenalar'], ['/ilova/arizalarim', 'Arizalarim']]
    : [['/ilova/biznes', 'Smenalarim'], ['/ilova/yangi', 'Smena e’lon qilish']];

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
        {/* Javob kelguncha joyi saqlanadi, lekin ko'rinmaydi: kirgan foydalanuvchiga "Kirish" lip etib ko'rinmasin */}
        <div className="nav-act" style={me === undefined ? { visibility: 'hidden' } : undefined}>
          <Link className="link-ink" href={first[0]}>{first[1]}</Link>
          <Link className="btn" href={second[0]}>{second[1]}</Link>
        </div>
      </header>
    </>
  );
}
