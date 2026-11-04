'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp, useLoad } from '@/components/app/AppShell';
import { ActionButton, Reviews, Ticket } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, STATUS, type Review, type Shift } from '@/lib/client';

type Org = {
  id: number; org: string; org_type: string | null; region: string | null; district: string | null; demo: number;
  rating: number | null; done: number; paid_n: number; paid_pct: number | null;
};

// Biznes sahifasi: ishchilar bahosi va sharhlari, haqni o'z vaqtida to'lash foizi va ochiq smenalari
export default function OrgPage() {
  const { id } = useParams<{ id: string }>();
  const { me, refreshMe } = useApp();
  const { t } = useT();
  const { data, error } = useLoad<{ org: Org; reviews: Review[] }>(`/orgs/${Number(id)}`);
  const { data: shifts, reload } = useLoad<Shift[]>(`/shifts?org=${Number(id)}`);
  if (error) return <p className="banner danger">{error}</p>;
  if (!data) return null;
  const { org, reviews } = data;

  return (
    <>
      <Link className="back" href="/ilova/smenalar">{t('Smenalar')}</Link>
      <h1>{org.org}</h1>
      <p className="lead">{[org.org_type && t(org.org_type), org.district, org.region].filter(Boolean).join(' · ')}</p>
      <div className="org-stats">
        <div className="stat"><b>{org.rating ? `★ ${org.rating}` : '—'}</b><span>{t('ishchilar bahosi')}</span></div>
        <div className="stat"><b>{org.done}</b><span>{t('bajarilgan smena')}</span></div>
        <div className="stat"><b>{org.paid_pct != null ? `${org.paid_pct}%` : '—'}</b>
          <span>{org.paid_pct != null ? t('haqni o‘z vaqtida to‘lagan ({n} ta javob)', { n: org.paid_n }) : t('to‘lov haqida hali javob yo‘q')}</span></div>
      </div>
      <p className="hint">{t('Foiz ishchilarning “Haqimni oldim” javoblaridan: smena tugaganidan keyin bir sutka ichida to‘langan haq — o‘z vaqtida.')}</p>

      <h2 style={{ marginTop: 32 }}>{t('Ochiq smenalar')}</h2>
      {shifts && (shifts.length ? (
        <div className="tickets">
          {shifts.map((s) => (
            <Ticket key={s.id} s={s}>
              {s.my_status ? <p className={`chip chip-${s.my_status}`}>{t(STATUS[s.my_status])}</p>
                : s.demo ? <p className="chip">{t('Demo smena: ariza qabul qilinmaydi')}</p>
                : (s.taken ?? 0) >= (s.slots ?? 0) ? <p className="chip">{t('Joy qolmadi')}</p>
                : !me ? <Link className="btn" href="/ilova/kirish">{t('Ariza berish uchun kiring')}</Link>
                : me.role === 'worker' && !me.blocked
                  ? <ActionButton run={() => api(`/shifts/${s.id}/apply`, {}).then(() => { reload(); refreshMe(); })} done={t('Ariza yuborildi')}>{t('Ariza berish')}</ActionButton>
                  : null}
            </Ticket>
          ))}
        </div>
      ) : <p className="hint">{t('Hozir ochiq smenasi yo‘q.')}</p>)}

      <h2 style={{ marginTop: 32 }}>{t('Ishchilar sharhlari')}</h2>
      <section className="sheet"><Reviews items={reviews} empty={t('Hali sharh yo‘q.')} /></section>
    </>
  );
}
