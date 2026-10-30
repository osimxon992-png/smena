'use client';

import Link from 'next/link';
import { useApp, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, Ticket } from '@/components/app/parts';
import { api, STATUS, type Shift } from '@/lib/client';

export default function OpenShifts() {
  const { me, refreshMe } = useApp();
  const { data, error, reload } = useLoad<Shift[]>('/shifts');

  function action(s: Shift) {
    if (s.my_status) return <p className={`chip chip-${s.my_status}`}>{STATUS[s.my_status]}</p>;
    if (s.demo) return <p className="chip">Demo smena: ariza qabul qilinmaydi</p>;
    if ((s.taken ?? 0) >= (s.slots ?? 0)) return <p className="chip">Joy qolmadi</p>;
    if (!me) return <Link className="btn" href="/ilova/kirish">Ariza berish uchun kiring</Link>;
    if (me.role !== 'worker' || me.blocked) return null;
    return <ActionButton run={() => api(`/shifts/${s.id}/apply`, {}).then(() => { reload(); refreshMe(); })} done="Ariza yuborildi">Ariza berish</ActionButton>;
  }

  return (
    <>
      <h1>Ochiq smenalar</h1>
      <BlockedBanner />
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length
        ? <div className="tickets">{data.map((s) => <Ticket key={s.id} s={s}>{action(s)}</Ticket>)}</div>
        : <Empty title="Hozircha ochiq smena yo‘q">Yangi smenalar har kuni qo‘shiladi. Kechroq qaytib ko‘ring.</Empty>)}
    </>
  );
}
