'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { Empty, Ticket } from '@/components/app/parts';
import type { Shift } from '@/lib/client';

export default function MyShifts() {
  const me = useGuard('business');
  const { data, error } = useLoad<Shift[]>(me ? '/my/shifts' : null);
  if (!me) return null;

  return (
    <>
      <div className="head"><h1>Smenalarim</h1><Link className="btn" href="/ilova/yangi">Yangi smena</Link></div>
      {me.rating ? <p className="lead">Ishchilar bergan baho: <span className="stars">★ {me.rating}</span></p> : null}
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length ? (
        <div className="tickets">
          {data.map((s) => (
            <Ticket key={s.id} s={s}>
              <Link className="btn btn-ghost" href={`/ilova/smena/${s.id}`}>Arizalar{s.pending ? ` (${s.pending} ta yangi)` : ''}</Link>
            </Ticket>
          ))}
        </div>
      ) : (
        <Empty title="Hali smena e’lon qilmagansiz">Sana, vaqt va haqni yozing: ishchilar ariza beradi, siz tanlaysiz. <Link href="/ilova/yangi">Birinchi smenani e’lon qiling</Link>.</Empty>
      ))}
    </>
  );
}
