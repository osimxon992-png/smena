'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, StarsForm, Ticket, TrustLine } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, STATUS, tashkentDate, type Shift, type Status } from '@/lib/client';
import { TELEGRAM_BOT } from '@/lib/options';

// can_checkin: "Keldim" tugmasi hozir ishlaydi (smena boshlanishidan 1 soat oldindan tugaguncha)
type Application = Shift & {
  status: Status; business_rating: number | null; phone: string | null;
  confirm: 'yes' | 'no' | null; checkin_at: string | null; can_checkin: boolean;
};

export default function MyApplications() {
  const me = useGuard('worker');
  const { t } = useT();
  const { data, error, reload } = useLoad<Application[]>(me ? '/my/applications' : null);
  if (!me) return null;
  const today = tashkentDate();

  return (
    <>
      <h1>{t('Arizalarim')}</h1>
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
              {a.phone && <p className="contact">{t('Ish beruvchi:')} <a href={`tel:${a.phone}`}>{a.phone}</a></p>}
              {a.checkin_at && <p className="banner ok">📍 {t('“Keldim” deb belgiladingiz: {time}', { time: a.checkin_at.slice(11) })}</p>}
              {a.can_checkin && (
                <ActionButton className="btn btn-lg btn-checkin" run={() => api(`/applications/${a.id}/checkin`, {}).then(reload)} done={t('Ish beruvchiga xabar berildi')}>
                  📍 {t('Keldim')}
                </ActionButton>
              )}
              {a.status === 'accepted' && !a.checkin_at && !a.can_checkin && a.date >= today && (
                <p className="hint">{t('Smena boshlanishidan bir soat oldin “Keldim” tugmasi ochiladi: joyiga yetib kelgach bosing.')}</p>
              )}
              {a.status === 'accepted' && a.confirm === 'no' && <p className="hint">{t('Kela olmasligingizni aytdingiz. Ish beruvchi sizni ozod qilishini kuting.')}</p>}
              {a.status === 'accepted' && a.date === today && !a.checkin_at && <p className="hint">{t('Bugun bekor qilib bo‘lmaydi. Kelmasangiz, hisobingiz bloklanadi.')}</p>}
              {(a.status === 'pending' || (a.status === 'accepted' && a.date > today)) && (
                <ActionButton className="btn btn-ghost" run={() => api(`/applications/${a.id}/cancel`, {}).then(reload)} done={t('Ariza bekor qilindi')}>{t('Arizani bekor qilish')}</ActionButton>
              )}
              {a.status === 'came' && !a.business_rating && (
                <StarsForm id={`b${a.id}`} legend={t('Ish beruvchini baholang')} button={t('Baholash')} onRate={(rating) => api(`/applications/${a.id}/rate`, { rating }).then(reload)} />
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
