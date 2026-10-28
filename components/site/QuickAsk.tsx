'use client';

import { useRouter } from 'next/navigation';

// Bosh sahifadan savol yozib, savollar sahifasida shu so'z bo'yicha qidirish
export default function QuickAsk() {
  const router = useRouter();
  return (
    <form className="quick-ask" role="search" onSubmit={(e) => {
      e.preventDefault();
      const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
      router.push(q ? `/savollar?q=${encodeURIComponent(q)}` : '/savollar');
    }}>
      <label className="sr" htmlFor="quick-q">Savolingiz</label>
      <input id="quick-q" name="q" type="search" placeholder="Masalan: bekor qilish" autoComplete="off" />
      <button className="btn" type="submit">Javob topish</button>
    </form>
  );
}
