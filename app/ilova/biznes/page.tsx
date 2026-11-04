'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { Empty, Ticket } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { tashkentDate, type Shift } from '@/lib/client';

export default function MyShifts() {
  const me = useGuard('business');
  const { t } = useT();
  const { data, error } = useLoad<Shift[]>(me ? '/my/shifts' : null);
  if (!me) return null;
  const today = tashkentDate();

  return (
    <>
      <div className="head">
        <h1>{t('Smenalarim')}</h1>
        <div className="actions">
          <Link className="btn btn-line" href="/ilova/sevimlilar">★ {t('Sevimli ishchilar')}</Link>
          <Link className="btn btn-line" href="/ilova/daromad">📊 {t('Hisobot')}</Link>
          <Link className="btn" href="/ilova/yangi">{t('Yangi smena')}</Link>
        </div>
      </div>
      {me.rating || me.hired ? (
        <p className="lead">
          {me.rating ? <>{t('Ishchilar bergan baho:')} <span className="stars">★ {me.rating}</span>. </> : null}
          {me.hired ? t('Smenalaringizda {n} marta ish bajarilgan.', { n: me.hired }) : null}
          {me.paid_pct != null ? <> {t('Haqni o‘z vaqtida to‘lash: {pct}%.', { pct: me.paid_pct })}</> : null}
        </p>
      ) : null}
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length ? (
        <div className="tickets">
          {data.map((s) => (
            <Ticket key={s.id} s={{ ...s, business_id: undefined }}>
              {s.date >= today && (s.taken || s.checked_in) ? (
                <p className="hint">
                  {t('Qabul qilingan: {n}', { n: s.taken ?? 0 })}
                  {s.confirmed ? ` · ✅ ${t('tasdiqladi: {n}', { n: s.confirmed })}` : ''}
                  {s.checked_in ? ` · 📍 ${t('keldi: {n}', { n: s.checked_in })}` : ''}
                </p>
              ) : null}
              <div className="actions">
                <Link className="btn btn-ghost" href={`/ilova/smena/${s.id}`}>{t('Arizalar')}{s.pending ? ` (${t('{n} ta yangi', { n: s.pending })})` : ''}</Link>
                <Link className="btn btn-ghost" href={`/ilova/yangi?nusxa=${s.id}`}>{t('Nusxa olish')}</Link>
              </div>
            </Ticket>
          ))}
        </div>
      ) : (
        <Empty title={t('Hali smena e’lon qilmagansiz')}>{t('Sana, vaqt va haqni yozing: ishchilar ariza beradi, siz tanlaysiz.')} <Link href="/ilova/yangi">{t('Birinchi smenani e’lon qiling')}</Link>.</Empty>
      ))}
    </>
  );
}
