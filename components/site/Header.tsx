'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LangSwitch, useT } from '@/components/Lang';
import { api, type Me } from '@/lib/client';

const LINKS = [
  ['/qanday-ishlaydi', 'Qanday ishlaydi'],
  ['/qoidalar', 'Qoidalar'],
  ['/bizneslar', 'Bizneslar uchun'],
  ['/savollar', 'Savollar'],
];

export default function Header() {
  const path = usePathname();
  const { t } = useT();
  // undefined: hali bilinmaydi. Kirgan foydalanuvchiga "Kirish" o'rniga o'z sahifalari ko'rinadi
  const [me, setMe] = useState<Me | null>();
  useEffect(() => { api<Me | null>('/me').then(setMe, () => setMe(null)); }, []);
  const [first, second] = !me ? [['/ilova/kirish', 'Kirish'], ['/ilova/royxat', 'Ro‘yxatdan o‘tish']]
    : me.role === 'worker' ? [['/ilova/smenalar', 'Smenalar'], ['/ilova/arizalarim', 'Arizalarim']]
    : [['/ilova/biznes', 'Smenalarim'], ['/ilova/yangi', 'Smena e’lon qilish']];

  return (
    <>
      <a className="skip" href="#asosiy">{t('Asosiy qismga o‘tish')}</a>
      <header className="nav wrap">
        <Link className="logo" href="/">Smena</Link>
        <nav aria-label={t('Sahifalar')}>
          {LINKS.map(([href, text]) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{t(text)}</Link>
          ))}
        </nav>
        {/* Javob kelguncha joyi saqlanadi, lekin ko'rinmaydi: kirgan foydalanuvchiga "Kirish" lip etib ko'rinmasin */}
        <div className="nav-act" style={me === undefined ? { visibility: 'hidden' } : undefined}>
          <LangSwitch />
          <Link className="link-ink" href={first[0]}>{t(first[1])}</Link>
          <Link className="btn" href={second[0]}>{t(second[1])}</Link>
        </div>
      </header>
    </>
  );
}
