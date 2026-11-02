'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApp, useGuard, useLoad } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { ActionButton, Empty, TrustLine } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, tashkentDate, type Shift, type Trust } from '@/lib/client';

// with_me: men bilan necha smena ishlagan, last_date: oxirgisi; phone — avval qabul qilingan bo'lsa
type Favorite = Trust & {
  id: number; name: string; blocked: number; photo: string | null; age: number | null; region: string | null; district: string | null;
  skills: string[]; with_me: number; last_date: string | null; phone: string | null;
};

// Sevimli ishchini ochiq smenaga taklif qilish: unga Telegram'da xabar boradi
function Invite({ worker, shifts }: { worker: Favorite; shifts: Shift[] }) {
  const { toast } = useApp();
  const { t, day } = useT();
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  if (!shifts.length) return <p className="hint">{t('Taklif qilish uchun avval ochiq smena e’lon qiling.')}</p>;
  async function send() {
    setBusy(true);
    try {
      await api(`/favorites/${worker.id}/invite`, { shift_id: Number(pick) });
      toast(t('Taklif yuborildi'));
      setPick('');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="invite">
      <select aria-label={t('Qaysi smenaga taklif qilasiz?')} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">{t('Smenaga taklif qilish…')}</option>
        {shifts.map((s) => <option key={s.id} value={s.id}>{s.title} · {day(s.date, false)}, {s.start_time}</option>)}
      </select>
      <button type="button" className="btn" disabled={!pick || busy} onClick={send}>{t('Taklif yuborish')}</button>
    </div>
  );
}

export default function Favorites() {
  const me = useGuard('business');
  const { t, day } = useT();
  const { data, error, reload } = useLoad<Favorite[]>(me ? '/favorites' : null);
  const { data: mine } = useLoad<Shift[]>(me ? '/my/shifts' : null);
  if (!me) return null;
  const today = tashkentDate();
  const open = (mine ?? []).filter((s) => s.date >= today && (s.taken ?? 0) < (s.slots ?? 0)).reverse();

  return (
    <>
      <Link className="back" href="/ilova/biznes">{t('Smenalarim')}</Link>
      <h1>{t('Sevimli ishchilar')}</h1>
      <p className="lead">{t('Yaxshi ishlagan ishchilarni arizalar ro‘yxatida ☆ bilan belgilang. Yangi smena e’lon qilsangiz, ularga birinchi bo‘lib Telegram’da xabar boradi; xohlasangiz, aniq smenaga taklif qilasiz.')}</p>
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length ? (
        <ul className="people">
          {data.map((w) => (
            <li key={w.id} className="person">
              <div className="person-head">
                <div className="person-who">
                  <Avatar photo={w.photo} name={w.name} className="avatar-md" />
                  <div>
                    <strong>{w.name}</strong>{w.blocked ? <> <span className="chip chip-noshow">{t('Bloklangan')}</span></> : null}
                    <p className="muted">{[w.age && t('{n} yosh', { n: w.age }), w.district, w.region].filter(Boolean).join(', ')}</p>
                    <TrustLine trust={w} />
                    <p className="muted">
                      {w.with_me ? t('Siz bilan {n} ta smena ishlagan, oxirgisi: {date}', { n: w.with_me, date: day(w.last_date!, false) }) : t('Siz bilan hali smena ishlamagan')}
                    </p>
                    {w.phone && <p><a href={`tel:${w.phone}`}>{w.phone}</a></p>}
                  </div>
                </div>
                <ActionButton className="btn btn-ghost" run={() => api(`/favorites/${w.id}`, { on: false }).then(reload)} done={t('Sevimlilardan olib tashlandi')}>
                  {t('Olib tashlash')}
                </ActionButton>
              </div>
              {w.skills.length > 0 && <ul className="skill-list">{w.skills.map((s) => <li key={s}>{t(s)}</li>)}</ul>}
              {!w.blocked && <Invite worker={w} shifts={open} />}
            </li>
          ))}
        </ul>
      ) : (
        <Empty title={t('Hali sevimli ishchi yo‘q')}>{t('Smena arizalarida ishchi yonidagi ☆ tugmasini bosing.')} <Link href="/ilova/biznes">{t('Smenalarimga o‘tish')}</Link></Empty>
      ))}
    </>
  );
}
