'use client';

import Link from 'next/link';
import { useApp } from '@/components/app/AppShell';
import { useT } from '@/components/Lang';

export default function SupportPage() {
  const { me } = useApp();
  const { t } = useT();

  const questions = [
    { q: 'Smenaga qabul qilinishimni qayerdan bilaman?', a: 'Sizga Telegram botimiz (@smenauzbbot) orqali darhol xabar keladi. Shuningdek, ilovaning "Arizalarim" bo‘limida holat o‘zgaradi.' },
    { q: 'Smenaga kela olmasam nima bo‘ladi?', a: 'Smenadan bir kun oldin bepul bekor qilishingiz mumkin. Smena kuni kelmasangiz, profilingiz bloklanishi mumkin.' },
    { q: 'Haqimni qachon olaman?', a: 'Ish haqi smena tugagach, bevosita ish beruvchi tomonidan to‘lanadi. Smena tugagach "Haqimni oldim" tugmasini bosishni unutmang.' },
    { q: 'Biznes sifatida qanday smena e’lon qilaman?', a: 'Profil bo‘limida rolingizni "Biznes" ga o‘zgartiring va "Yangi smena" tugmasini bosing.' },
  ];

  return (
    <>
      <div className="head">
        <h1>{t('Yordam markazi')}</h1>
      </div>
      <p className="lead">{t('Savollaringiz bormi? Quyidagi javoblar bilan tanishib chiqing yoki biz bilan bog‘laning.')}</p>

      <div className="faq sheet">
        {questions.map((item, i) => (
          <details key={i} className="faq-item">
            <summary><b>{t(item.q)}</b></summary>
            <div className="faq-answer">{t(item.a)}</div>
          </details>
        ))}
      </div>

      <section className="support-contact sheet">
        <h2>{t('Biz bilan bog‘lanish')}</h2>
        <p>{t('Agar muammo hal bo‘lmasa, admin bilan Telegram orqali bog‘lanishingiz mumkin:')}</p>
        <a className="btn btn-line" href="https://t.me/osimxon_00" target="_blank" rel="noreferrer">✈️ @osimxon_00</a>
      </section>

      <div className="foot-actions">
        <Link className="btn btn-ghost" href="/ilova/profil">{t('Profilga qaytish')}</Link>
      </div>
    </>
  );
}
