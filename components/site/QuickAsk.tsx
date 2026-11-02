'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/components/Lang';

// Bosh sahifadan savol yozib, savollar sahifasida shu so'z bo'yicha qidirish
export default function QuickAsk() {
  const router = useRouter();
  const { t } = useT();
  return (
    <form className="quick-ask" role="search" onSubmit={(e) => {
      e.preventDefault();
      const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
      router.push(q ? `/savollar?q=${encodeURIComponent(q)}` : '/savollar');
    }}>
      <label className="sr" htmlFor="quick-q">{t('Savolingiz')}</label>
      <input id="quick-q" name="q" type="search" placeholder={t('Masalan: bekor qilish')} autoComplete="off" />
      <button className="btn" type="submit">{t('Javob topish')}</button>
    </form>
  );
}
