'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGuard, useLoad } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { ActionButton, Empty, StarsForm, Ticket } from '@/components/app/parts';
import { api, STATUS, tashkentDate, type Shift, type Status } from '@/lib/client';

type Applicant = {
  id: number; status: Status; worker_rating: number | null; name: string; blocked: number; phone: string | null; rating: number | null; done: number;
  photo: string | null; age: number | null; gender: 'm' | 'f' | null; region: string | null; district: string | null; skills: string[]; about: string | null;
};

export default function ShiftApplicants() {
  const me = useGuard('business');
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<{ shift: Shift; applicants: Applicant[] }>(me ? `/shifts/${Number(id)}` : null);
  if (!me) return null;
  if (error) return <p className="banner danger">{error}</p>;
  if (!data) return null;
  const { shift, applicants } = data;
  const decide = (a: Applicant, action: string, rating?: number) => api(`/applications/${a.id}`, { action, rating }).then(reload);

  return (
    <>
      <Link className="back" href="/ilova/biznes">Smenalarim</Link>
      <h1>{shift.title}</h1>
      <div className="tickets"><Ticket s={shift} /></div>
      <h2 style={{ marginTop: 32 }}>Arizalar</h2>
      {applicants.length ? (
        <ul className="people">
          {applicants.map((a) => (
            <li key={a.id} className="person">
              <div className="person-head">
                <div className="person-who">
                  <Avatar photo={a.photo} name={a.name} className="avatar-md" />
                  <div>
                    <strong>{a.name}</strong>{a.blocked ? <> <span className="chip chip-noshow">Bloklangan</span></> : null}
                    <p className="muted">{[a.age && `${a.age} yosh`, a.gender && (a.gender === 'm' ? 'erkak' : 'ayol'), a.district, a.region].filter(Boolean).join(', ')}</p>
                    <p className="muted">{a.rating ? `★ ${a.rating}, ` : 'Yangi ishchi, '}{a.done} ta smena bajargan</p>
                    {a.phone && <p><a href={`tel:${a.phone}`}>{a.phone}</a></p>}
                  </div>
                </div>
                <p className={`chip chip-${a.status}`}>{STATUS[a.status]}</p>
              </div>
              {a.skills.length > 0 && <ul className="skill-list">{a.skills.map((s) => <li key={s}>{s}</li>)}</ul>}
              {a.about && <p className="person-about">{a.about}</p>}
              {a.status === 'pending' && (
                <div className="actions">
                  <ActionButton run={() => decide(a, 'accept')} done="Ishchi qabul qilindi">Qabul qilish</ActionButton>
                  <ActionButton className="btn btn-ghost" run={() => decide(a, 'reject')} done="Ariza rad etildi">Rad etish</ActionButton>
                </div>
              )}
              {a.status === 'accepted' && (shift.date <= tashkentDate() ? (
                <div className="actions">
                  <StarsForm id={`w${a.id}`} legend="Keldi. Ishini baholang" button="Keldi deb belgilash" onRate={(rating) => decide(a, 'came', rating)} />
                  <ActionButton className="btn btn-danger" run={() => decide(a, 'noshow')} done="Ishchi bloklandi"
                    confirmText="Ishchi “kelmadi” deb belgilanadi va hisobi bloklanadi. Davom etasizmi?">Kelmadi</ActionButton>
                </div>
              ) : <p className="hint">Kelgan-kelmaganini smena kuni belgilaysiz.</p>)}
              {a.worker_rating ? <p className="hint">Siz bergan baho: <span className="stars">★ {a.worker_rating}</span></p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="Hali ariza yo‘q">Ishchilar ariza bersa, shu yerda ko‘rasiz va qabul qilasiz.</Empty>
      )}
    </>
  );
}
