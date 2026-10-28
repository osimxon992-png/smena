'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { som, tashkentDate, type Shift } from '@/lib/client';

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const label = (i: number, iso: string) => (i === 0 ? 'Bugun' : i === 1 ? 'Ertaga' : WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]);

// "Ertaga bo'shmisiz?" yonidagi kun tanlagich: tanlangan kundagi jonli ochiq smenalarni ko'rsatadi
export default function DayPicker() {
  // Kunlar faqat brauzerda hisoblanadi: sahifa build paytida tayyorlanadi, server sanasi eskirgan bo'ladi
  const [days, setDays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [pick, setPick] = useState(1);

  useEffect(() => {
    setDays(Array.from({ length: 7 }, (_, i) => tashkentDate(i)));
    fetch('/api/shifts').then((r) => (r.ok ? r.json() : [])).catch(() => []).then(setShifts);
  }, []);

  const open = (shifts ?? []).filter((s) => (s.taken ?? 0) < (s.slots ?? 0));
  const onDay = (iso: string) => open.filter((s) => s.date === iso);
  const list = days.length ? onDay(days[pick]) : [];

  return (
    <div className="daypick sheet taped">
      <h3>Qaysi kuni bo‘shsiz?</h3>
      <div className="day-chips" role="group" aria-label="Kunni tanlang">
        {days.map((iso, i) => (
          <button key={iso} type="button" className={`day-chip${shifts && !onDay(iso).length ? ' is-empty' : ''}`} aria-pressed={i === pick} onClick={() => setPick(i)}>
            <span>{label(i, iso)}</span>
            <small>{shifts ? `${onDay(iso).length} ta smena` : '…'}</small>
          </button>
        ))}
      </div>
      <div className="day-list" aria-live="polite" key={pick}>
        {list.length ? list.slice(0, 3).map((s) => (
          <Link key={s.id} className="day-row" href="/ilova/smenalar">
            <span className="day-row-time">{s.start_time}–{s.end_time}</span>
            <span className="day-row-role">{s.title}<small>{s.org}, {s.place}</small></span>
            <strong className="day-row-pay">{som(s.pay)}</strong>
          </Link>
        )) : (
          <p className="day-empty">{shifts ? 'Bu kunga hali ochiq smena yo‘q. Boshqa kunni tanlang yoki keyinroq qayting.' : 'Smenalar yuklanmoqda…'}</p>
        )}
      </div>
      {list.length > 3 && <Link className="more-go" href="/ilova/smenalar">Yana {list.length - 3} ta smena</Link>}
    </div>
  );
}
