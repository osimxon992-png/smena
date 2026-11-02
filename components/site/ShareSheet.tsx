'use client';

import { useState } from 'react';
import { useT } from '@/components/Lang';

// Sahifani do'stga yuborish: telefonda tizimning ulashish oynasi, kompyuterda havolani nusxalash
export default function ShareSheet() {
  const [note, setNote] = useState('');
  const { t } = useT();
  async function share() {
    const data = { title: document.title, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); setNote(t('Havola nusxalandi')); }
    } catch (e) {
      // Foydalanuvchi ulashish oynasini yopsa — xato emas
      if ((e as Error).name !== 'AbortError') setNote(t('Nusxalab bo‘lmadi. Manzil satridan oling'));
    }
  }
  return (
    <div className="share sheet">
      <p>{t('Bir kunlik ish qidirayotgan do‘stingiz bormi? Shu sahifani unga yuboring.')}</p>
      <button type="button" className="btn btn-line" onClick={share}>{t('Do‘stga yuborish')}</button>
      <span className="share-note" role="status">{note}</span>
    </div>
  );
}
