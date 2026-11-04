'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, StarsForm, Ticket, TrustLine } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, locate, meters, STATUS, tashkentDate, type Shift, type Status } from '@/lib/client';
import { TELEGRAM_BOT } from '@/lib/options';

// can_checkin: "Keldim" tugmasi hozir ishlaydi (smena boshlanishidan 1 soat oldindan tugaguncha);
// paid: haq olindimi (yes — o'z vaqtida, late — kechikib, no — hali yo'q); brigade_id: brigada bilan berilgan ariza
type Application = Shift & {
  status: Status; business_rating: number | null; phone: string | null;
  confirm: 'yes' | 'no' | null; checkin_at: string | null; checkin_dist: number | null; can_checkin: boolean;
  paid: 'yes' | 'late' | 'no' | null; brigade_id: number | null;
};

export default function MyApplications() {
  const me = useGuard('worker');
  const { t } = useT();
  const { data, error, reload } = useLoad<Application[]>(me ? '/my/applications' : null);
  if (!me) return null;
  const today = tashkentDate();

  // Smena joyi xaritada bo'lsa, "Keldim" telefon joylashuvi bilan yuboriladi (server 300 m ichidaligini tekshiradi)
  async function checkin(a: Application) {
    const here = a.lat != null
      ? await locate({ denied: t('“Keldim” uchun joylashuvga ruxsat bering: brauzer sozlamalarida shu saytga joylashuvni yoqing'), failed: t('Joylashuvni aniqlab bo‘lmadi. Ochiq joyga chiqib, qayta bosing') })
      : {};
    await api(`/applications/${a.id}/checkin`, here);
    reload();
  }
  const paid = (a: Application, got: boolean) => api(`/applications/${a.id}/paid`, { got }).then(reload);

  return (
    <>
      <div className="head">
        <h1>{t('Arizalarim')}</h1>
        <div className="actions">
          <Link className="btn btn-line" href="/ilova/brigada">👥 {t('Brigadam')}</Link>
          <Link className="btn btn-line" href="/ilova/daromad">📊 {t('Daromadim')}</Link>
        </div>
      </div>
      {me.done || me.noshows ? (
        <div className="lead"><TrustLine trust={{ rating: me.rating, done: me.done ?? 0, noshows: me.noshows ?? 0, checkins: me.checkins ?? 0, reliability: me.reliability ?? null, badge: me.badge ?? null }} /></div>
      ) : <p className="lead">{t('Birinchi smenangizdan keyin bu yerda reytingingiz va ishonch ko‘rsatkichlaringiz chiqadi.')}</p>}
      <p className="hint">
        {t('Qabul, eslatma va boshqa xabarlar Telegram’dagi botga keladi:')}{' '}
        <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a>
      </p>
      <BlockedBanner />
      {error && <p className="banner danger">{error}</p>}
      {data && (data.length ? (
        <div className="tickets">
          {data.map((a) => (
            <Ticket key={a.id} s={a}>
              <p className={`chip chip-${a.status}`}>{t(STATUS[a.status])}</p>
              {a.brigade_id ? <p className="chip chip-team">👥 {t('Brigada bilan')}</p> : null}
              {a.phone && <p className="contact">{t('Ish beruvchi:')} <a href={`tel:${a.phone}`}>{a.phone}</a></p>}
              {a.checkin_at && (
                <p className="banner ok">📍 {t('“Keldim” deb belgiladingiz: {time}', { time: a.checkin_at.slice(11) })}
                  {a.checkin_dist != null ? ` · ${t('smena joyidan {dist}', { dist: meters(a.checkin_dist) })}` : ''}</p>
              )}
              {a.can_checkin && (
                <ActionButton className="btn btn-lg btn-checkin" run={() => checkin(a)} done={t('Ish beruvchiga xabar berildi')}>
                  📍 {t('Keldim')}
                </ActionButton>
              )}
              {a.can_checkin && a.lat != null && <p className="hint">{t('“Keldim” smena joyidan 300 m ichida ishlaydi: telefon joylashuvingiz tekshiriladi.')}</p>}
              {a.status === 'accepted' && !a.checkin_at && !a.can_checkin && a.date >= today && (
                <p className="hint">{t('Smena boshlanishidan bir soat oldin “Keldim” tugmasi ochiladi: joyiga yetib kelgach bosing.')}</p>
              )}
              {a.status === 'accepted' && a.confirm === 'no' && <p className="hint">{t('Kela olmasligingizni aytdingiz. Ish beruvchi sizni ozod qilishini kuting.')}</p>}
              {a.status === 'accepted' && a.date === today && !a.checkin_at && <p className="hint">{t('Bugun bekor qilib bo‘lmaydi. Kelmasangiz, hisobingiz bloklanadi.')}</p>}
              {(a.status === 'pending' || (a.status === 'accepted' && a.date > today)) && (
                <ActionButton className="btn btn-ghost" run={() => api(`/applications/${a.id}/cancel`, {}).then(reload)} done={t('Ariza bekor qilindi')}>{t('Arizani bekor qilish')}</ActionButton>
              )}
              {a.status === 'came' && (a.paid === 'yes' || a.paid === 'late') && <p className="chip chip-came">💸 {t('Haq olindi')}</p>}
              {a.status === 'came' && (a.paid === null || a.paid === 'no') && (
                <div className="paid-ask">
                  <p>{a.paid === 'no' ? t('Ish beruvchiga haqingizni olmaganingizni aytdik. Olgach, belgilang:') : t('Haqingizni oldingizmi?')}</p>
                  <div className="actions">
                    <ActionButton run={() => paid(a, true)} done={t('Rahmat! Belgilandi')}>💸 {t('Haqimni oldim')}</ActionButton>
                    {a.paid === null && <ActionButton className="btn btn-ghost" run={() => paid(a, false)} done={t('Ish beruvchiga xabar berildi')}>⏳ {t('Hali olmadim')}</ActionButton>}
                  </div>
                </div>
              )}
              {a.status === 'came' && !a.business_rating && (
                <StarsForm id={`b${a.id}`} legend={t('Ish beruvchini baholang')} button={t('Baholash')}
                  placeholder={t('Sharoit, munosabat, haq o‘z vaqtida berildimi (ixtiyoriy)')}
                  onRate={(rating, review) => api(`/applications/${a.id}/rate`, { rating, review }).then(reload)} />
              )}
            </Ticket>
          ))}
        </div>
      ) : (
        <Empty title={t('Hali ariza bermagansiz')}><Link href="/ilova/smenalar">{t('Ochiq smenalarni ko‘ring')}</Link> {t('va birinchisini tanlang.')}</Empty>
      ))}
    </>
  );
}
