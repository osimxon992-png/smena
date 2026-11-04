'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useGuard, useLoad } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { ActionButton, Field, PhoneInput, TrustLine, useSubmit } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, type Trust } from '@/lib/client';

type Member = Trust & { id: number; name: string; blocked: number; joined: boolean; photo: string | null };
type Data = {
  brigade: { id: number; name: string; leader_id: number; mine: boolean; members: Member[] } | null;
  invites: { id: number; name: string; leader: string }[];
};

// Brigada: do'stlar bilan birga ishlash. Boshliq raqam bo'yicha taklif qiladi, a'zo qo'shilgach boshliq hamma nomidan ariza beradi
export default function BrigadePage() {
  const me = useGuard('worker');
  const { t } = useT();
  const { data, error, reload } = useLoad<Data>(me ? '/brigade' : null);
  const create = useSubmit(async (body) => { await api('/brigade', body); reload(); });
  // Taklif yuborilgach forma tozalanadi (key almashib, qaytadan chiziladi)
  const [sent, setSent] = useState(0);
  const invite = useSubmit(async (body) => {
    await api('/brigade/invite', body);
    reload();
    setSent((n) => n + 1);
  });
  if (!me) return null;
  const b = data?.brigade;

  return (
    <>
      <Link className="back" href="/ilova/arizalarim">{t('Arizalarim')}</Link>
      <h1>{b ? `👥 ${b.name}` : t('Brigada')}</h1>
      <p className="lead">{t('Do‘stlaringiz bilan birga ishlang: boshliq bitta bosishda butun brigada nomidan ariza beradi, biznes esa brigadani birga qabul qiladi.')}</p>
      {error && <p className="banner danger">{error}</p>}

      {data && data.invites.length > 0 && (
        <section className="sheet invites">
          <h2>{t('Sizni taklif qilishdi')}</h2>
          <ul className="plain-list">
            {data.invites.map((i) => (
              <li key={i.id}>
                <p><b>{i.name}</b> <span className="muted">· {t('boshlig‘i {name}', { name: i.leader })}</span></p>
                <div className="actions">
                  <ActionButton run={() => api('/brigade/answer', { id: i.id, accept: true }).then(reload)} done={t('Brigadaga qo‘shildingiz')}>{t('Qo‘shilish')}</ActionButton>
                  <ActionButton className="btn btn-ghost" run={() => api('/brigade/answer', { id: i.id, accept: false }).then(reload)} done={t('Taklif rad etildi')}>{t('Rad etish')}</ActionButton>
                </div>
              </li>
            ))}
          </ul>
          {b && <p className="hint">{t('Boshqa brigadaga qo‘shilish uchun avval hozirgisidan chiqing.')}</p>}
        </section>
      )}

      {data && !b && (
        <form className="form narrow" onSubmit={create.onSubmit}>
          <h2>{t('Brigada tuzish')}</h2>
          <Field label={t('Brigada nomi')}><input name="name" required minLength={2} maxLength={40} placeholder={t('Masalan: Chilonzor yigitlari')} /></Field>
          <button className="btn btn-lg" type="submit" disabled={create.busy}>{t('Brigada tuzish')}</button>
          {create.error && <p className="form-error" role="alert">{create.error}</p>}
          <p className="hint">{t('Siz boshliq bo‘lasiz va ishchilarni telefon raqami bo‘yicha taklif qilasiz. Ular Telegram’da yoki shu sahifada qo‘shiladi.')}</p>
        </form>
      )}

      {b && (
        <div className="profile-grid">
          <section className="sheet">
            <h2>{t('A’zolar')}</h2>
            <ul className="people">
              {b.members.map((m) => (
                <li key={m.id} className="person">
                  <div className="person-head">
                    <div className="person-who">
                      <Avatar photo={m.photo} name={m.name} className="avatar-md" />
                      <div>
                        <strong>{m.name}</strong>
                        {m.id === b.leader_id && <> <span className="chip">{t('Boshliq')}</span></>}
                        {!m.joined && <> <span className="chip chip-pending">{t('Taklif yuborilgan')}</span></>}
                        {m.blocked ? <> <span className="chip chip-noshow">{t('Bloklangan')}</span></> : null}
                        <TrustLine trust={m} />
                      </div>
                    </div>
                    {b.mine && m.id !== b.leader_id && (
                      <ActionButton className="btn btn-ghost" run={() => api(`/brigade/members/${m.id}/remove`, {}).then(reload)} done={t('Olib tashlandi')}
                        confirmText={t('{name} brigadadan olib tashlansinmi?', { name: m.name })}>{m.joined ? t('Olib tashlash') : t('Taklifni bekor qilish')}</ActionButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <ActionButton className="btn btn-danger" run={() => api('/brigade/leave', {}).then(reload)} done={b.mine ? t('Brigada tarqatildi') : t('Brigadadan chiqdingiz')}
              confirmText={b.mine ? t('Brigada tarqatiladi va a’zolarga xabar boradi. Davom etasizmi?') : t('Brigadadan chiqasizmi?')}>
              {b.mine ? t('Brigadani tarqatish') : t('Brigadadan chiqish')}
            </ActionButton>
          </section>
          {b.mine ? (
            <form key={sent} className="form" onSubmit={invite.onSubmit}>
              <h2>{t('Ishchini taklif qilish')}</h2>
              <Field label={t('Telefon raqam')}><PhoneInput /></Field>
              <button className="btn" type="submit" disabled={invite.busy}>{t('Taklif yuborish')}</button>
              {invite.error && <p className="form-error" role="alert">{invite.error}</p>}
              <p className="hint">{t('Ishchi Smena’da ro‘yxatdan o‘tgan bo‘lishi kerak. Brigadada ko‘pi bilan 10 kishi.')}</p>
              <p className="hint">{t('Ariza berish: “Smenalar” sahifasida bo‘sh joyi yetarli smenada “👥 Brigada bilan” tugmasini bosing. Kela olmaydigan a’zo o‘z arizasini o‘zi bekor qiladi.')}</p>
            </form>
          ) : (
            <section className="sheet">
              <h2>{t('Qanday ishlaydi?')}</h2>
              <p>{t('Boshliq brigada nomidan smenaga ariza bersa, sizning nomingizdan ham ariza ketadi va Telegram’da xabar keladi. Kela olmasangiz, “Arizalarim” da arizangizni bekor qiling.')}</p>
            </section>
          )}
        </div>
      )}
    </>
  );
}
