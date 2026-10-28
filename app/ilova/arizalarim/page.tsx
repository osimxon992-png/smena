'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, StarsForm, Ticket } from '@/components/app/parts';
import { api, STATUS, tashkentDate, type Shift, type Status } from '@/lib/client';

type Application = Shift & { status: Status; business_rating: number | null; phone: string | null };

export default function MyApplications() {
  const me = useGuard('worker');
  const { data, error, reload } = useLoad<Application[]>(me ? '/my/applications' : null);
  if (!me) return null;
  const today = tashkentDate();

  return (
    <>
      <h1>Arizalarim</h1>
      <p className="lead">
        {me.done ? `${me.rating ? `Reytingingiz ★ ${me.rating}. ` : ''}${me.done} ta smena bajargansiz.` : 'Birinchi smenangizdan keyin bu yerda reytingingiz chiqadi.'}
      </p>
      <BlockedBanner />
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length ? (
        <div className="tickets">
          {data.map((a) => (
            <Ticket key={a.id} s={a}>
              <p className={`chip chip-${a.status}`}>{STATUS[a.status]}</p>
              {a.phone && <p className="contact">Ish beruvchi: <a href={`tel:${a.phone}`}>{a.phone}</a></p>}
              {a.status === 'accepted' && a.date === today && <p className="hint">Bugun bekor qilib bo‘lmaydi. Kelmasangiz, hisobingiz bloklanadi.</p>}
              {(a.status === 'pending' || (a.status === 'accepted' && a.date > today)) && (
                <ActionButton className="btn btn-ghost" run={() => api(`/applications/${a.id}/cancel`, {}).then(reload)} done="Ariza bekor qilindi">Arizani bekor qilish</ActionButton>
              )}
              {a.status === 'came' && !a.business_rating && (
                <StarsForm id={`b${a.id}`} legend="Ish beruvchini baholang" button="Baholash" onRate={(rating) => api(`/applications/${a.id}/rate`, { rating }).then(reload)} />
              )}
            </Ticket>
          ))}
        </div>
      ) : (
        <Empty title="Hali ariza bermagansiz"><Link href="/ilova/smenalar">Ochiq smenalarni ko‘ring</Link> va birinchisini tanlang.</Empty>
      ))}
    </>
  );
}
