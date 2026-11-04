'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGuard, useLoad } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { ActionButton, Empty, Reviews, StarsForm, Ticket, TrustLine } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, meters, STATUS, tashkentDate, type Review, type Shift, type Status, type Trust } from '@/lib/client';

type Applicant = Trust & {
  id: number; worker_id: number; status: Status; worker_rating: number | null; name: string; blocked: number; phone: string | null;
  photo: string | null; age: number | null; gender: 'm' | 'f' | null; region: string | null; district: string | null; skills: string[]; about: string | null;
  // confirm: eslatmaga javob (yes — kelaman, no — kela olmayman); checkin_at: "Keldim" bosgan vaqt (Toshkent); favorite: sevimlilarimda
  confirm: 'yes' | 'no' | null; checkin_at: string | null; favorite: boolean;
  // checkin_dist: "Keldim" paytida smena joyigacha metr; paid: ishchi haqni olganini belgilaganmi; brigada; boshqa bizneslar sharhlari
  checkin_dist: number | null; paid: 'yes' | 'late' | 'no' | null; worker_review: string | null;
  brigade_id: number | null; brigade_name: string | null; reviews: Review[];
};

export default function ShiftApplicants() {
  const me = useGuard('business');
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<{ shift: Shift; applicants: Applicant[] }>(me ? `/shifts/${Number(id)}` : null);
  if (!me) return null;
  if (error) return <p className="banner danger">{error}</p>;
  if (!data) return null;
  const { shift, applicants } = data;
  const decide = (a: Applicant, action: string, rating?: number, review?: string) => api(`/applications/${a.id}`, { action, rating, review }).then(reload);
  // Brigada: bir xil brigade_id li kutilayotgan arizalar; birinchisining tepasida "Brigadani qabul qilish"
  const pendingTeam = (a: Applicant) => applicants.filter((x) => x.brigade_id && x.brigade_id === a.brigade_id && x.status === 'pending');
  const free = (shift.slots ?? 0) - (shift.taken ?? 0);
  const favorite = (a: Applicant) => api(`/favorites/${a.worker_id}`, { on: !a.favorite }).then(reload);

  return (
    <>
      <Link className="back" href="/ilova/biznes">{t('Smenalarim')}</Link>
      <div className="head">
        <h1>{shift.title}</h1>
        <Link className="btn btn-line" href={`/ilova/yangi?nusxa=${shift.id}`}>{t('Nusxa olish')}</Link>
      </div>
      <div className="tickets"><Ticket s={shift} /></div>
      <h2 style={{ marginTop: 32 }}>{t('Arizalar')}</h2>
      {applicants.length ? (
        <ul className="people">
          {applicants.map((a, i) => (
            <li key={a.id} className={`person${a.brigade_id ? ' in-team' : ''}`}>
              {a.brigade_id && applicants[i - 1]?.brigade_id !== a.brigade_id && (
                <div className="team-head">
                  <p><b>👥 {t('Brigada: {name}', { name: a.brigade_name ?? '—' })}</b> <span className="muted">· {t('{n} kishi', { n: applicants.filter((x) => x.brigade_id === a.brigade_id).length })}</span></p>
                  {pendingTeam(a).length > 1 && (
                    pendingTeam(a).length <= free
                      ? <ActionButton run={() => decide(a, 'accept_team')} done={t('Brigada qabul qilindi')}>{t('Brigadani qabul qilish ({n} kishi)', { n: pendingTeam(a).length })}</ActionButton>
                      : <p className="hint">{t('Butun brigada uchun joy yetmaydi: {free} ta bo‘sh joy. Ishchilarni alohida qabul qilishingiz mumkin.', { free })}</p>
                  )}
                </div>
              )}
              <div className="person-head">
                <div className="person-who">
                  <Avatar photo={a.photo} name={a.name} className="avatar-md" />
                  <div>
                    <strong>{a.name}</strong>{a.blocked ? <> <span className="chip chip-noshow">{t('Bloklangan')}</span></> : null}
                    <p className="muted">{[a.age && t('{n} yosh', { n: a.age }), a.gender && t(a.gender === 'm' ? 'erkak' : 'ayol'), a.district, a.region].filter(Boolean).join(', ')}</p>
                    <TrustLine trust={a} />
                    {a.phone && <p><a href={`tel:${a.phone}`}>{a.phone}</a></p>}
                  </div>
                </div>
                <div className="person-side">
                  <p className={`chip chip-${a.status}`}>{t(STATUS[a.status])}</p>
                  <button type="button" className={`fav-toggle${a.favorite ? ' on' : ''}`} aria-pressed={a.favorite}
                    title={a.favorite ? t('Sevimlilardan olib tashlash') : t('Sevimlilarga qo‘shish')} onClick={() => favorite(a)}>
                    {a.favorite ? '★' : '☆'} <span>{a.favorite ? t('Sevimli') : t('Sevimlilarga')}</span>
                  </button>
                </div>
              </div>
              {a.skills.length > 0 && <ul className="skill-list">{a.skills.map((s) => <li key={s}>{t(s)}</li>)}</ul>}
              {a.about && <p className="person-about">{a.about}</p>}
              {a.reviews.length > 0 && (
                <details className="person-reviews">
                  <summary>{t('Bizneslar sharhlari ({n})', { n: a.reviews.length })}</summary>
                  <Reviews items={a.reviews} />
                </details>
              )}
              {a.status === 'accepted' && (a.checkin_at
                ? <p className="banner ok">📍 {t('Joyiga keldi deb belgiladi: {time}', { time: a.checkin_at.slice(11) })}
                    {a.checkin_dist != null ? ` · ${t('smena joyidan {dist}', { dist: meters(a.checkin_dist) })}` : ''}</p>
                : a.confirm === 'yes' ? <p className="hint">✅ {t('Kelishini Telegram’da tasdiqladi')}</p>
                : a.confirm === 'no' ? (
                  <div className="banner warn">
                    <p>⚠️ {t('Bugun kela olmasligini aytdi. Uni ozod qilsangiz, bloklanmaydi va joy boshqa ishchiga bo‘shaydi.')}</p>
                    <ActionButton className="btn btn-line" run={() => decide(a, 'release')} done={t('Ishchi ozod qilindi')}>{t('Ozod qilish')}</ActionButton>
                  </div>
                ) : null)}
              {a.status === 'pending' && (
                <div className="actions">
                  <ActionButton run={() => decide(a, 'accept')} done={t('Ishchi qabul qilindi')}>{t('Qabul qilish')}</ActionButton>
                  <ActionButton className="btn btn-ghost" run={() => decide(a, 'reject')} done={t('Ariza rad etildi')}>{t('Rad etish')}</ActionButton>
                </div>
              )}
              {a.status === 'accepted' && (shift.date <= tashkentDate() ? (
                <div className="actions">
                  <StarsForm id={`w${a.id}`} legend={t('Keldi. Ishini baholang')} button={t('Keldi deb belgilash')}
                    placeholder={t('Qanday ishladi: boshqa bizneslar ham ko‘radi (ixtiyoriy)')} onRate={(rating, review) => decide(a, 'came', rating, review)} />
                  <ActionButton className="btn btn-danger" run={() => decide(a, 'noshow')} done={t('Ishchi bloklandi')}
                    confirmText={t('Ishchi “kelmadi” deb belgilanadi va hisobi bloklanadi. Davom etasizmi?')}>{t('Kelmadi')}</ActionButton>
                </div>
              ) : <p className="hint">{t('Kelgan-kelmaganini smena kuni belgilaysiz.')}</p>)}
              {a.worker_rating ? <p className="hint">{t('Siz bergan baho:')} <span className="stars">★ {a.worker_rating}</span>{a.worker_review ? ` · “${a.worker_review}”` : ''}</p> : null}
              {a.status === 'came' && (
                <p className="hint">{a.paid === 'yes' ? `💸 ${t('Ishchi haqini o‘z vaqtida olganini tasdiqladi')}`
                  : a.paid === 'late' ? `💸 ${t('Ishchi haqini kechikib olganini tasdiqladi')}`
                  : a.paid === 'no' ? <b className="text-red">⚠️ {t('Ishchi haqini hali olmaganini aytdi')}</b>
                  : t('Ishchi haqni olganini hali belgilamadi')}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title={t('Hali ariza yo‘q')}>{t('Ishchilar ariza bersa, shu yerda ko‘rasiz va qabul qilasiz.')}</Empty>
      )}
    </>
  );
}
