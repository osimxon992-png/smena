'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp, useLoad } from '@/components/app/AppShell';
import { Empty } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { SHARE } from '@/lib/client';
import { monthName } from '@/lib/i18n';

type Item = { id: number; date: string; start_time: string; end_time: string; title: string; pay: number; who: string; paid: 'yes' | 'late' | 'no' | null };
type Month = { month: string; shifts: number; gross: number; share: number; net: number; hours: number; items: Item[] };
type Report = { role: 'worker' | 'business'; months: Month[]; total: Omit<Month, 'month' | 'items'> };

// Oylik hisobot. Ishchiga: topgani, Smena ulushi va qo'liga tushgani; biznesga: ishchilarga to'lagani.
// Har oyning boshida o'tgan oy hisoboti Telegram'ga ham keladi
export default function EarningsPage() {
  const { me, ready } = useApp();
  const router = useRouter();
  const { t, som, day, lang } = useT();
  useEffect(() => { if (ready && !me) router.replace('/ilova/kirish'); }, [ready, me, router]);
  const { data, error } = useLoad<Report>(me ? '/me/report' : null);
  const [open, setOpen] = useState('');
  if (!me) return null;
  const worker = me.role === 'worker';
  const month = data?.months.find((m) => m.month === open) ?? data?.months[0];

  return (
    <>
      <Link className="back" href={worker ? '/ilova/arizalarim' : '/ilova/biznes'}>{worker ? t('Arizalarim') : t('Smenalarim')}</Link>
      <div className="head">
        <h1>{worker ? t('Daromadim') : t('Xarajatlar hisoboti')}</h1>
        {month && <button type="button" className="btn btn-line no-print" onClick={() => print()}>🖨 {t('Chop etish')}</button>}
      </div>
      <p className="lead">{worker
        ? t('Bajarilgan smenalaringiz oyma-oy: topganingiz, Smena ulushi ({pct}%) va qo‘lingizga tushgani.', { pct: SHARE * 100 })
        : t('Smenalaringizda bajarilgan ishlar va ishchilarga to‘langan haq oyma-oy.')}</p>
      {error && <p className="banner danger">{error}</p>}
      {data && !data.months.length && (
        <Empty title={t('Hali bajarilgan smena yo‘q')}>
          {worker ? t('Birinchi smenangizdan keyin hisobot shu yerda chiqadi.') : t('Ishchi “keldi” deb belgilangan smenalar shu yerda hisoblanadi.')}
        </Empty>
      )}
      {data && month && (
        <div className="report">
          <div className="pick-row month-pick no-print" role="group" aria-label={t('Oy')}>
            {data.months.map((m) => (
              <button key={m.month} type="button" className="pick" aria-pressed={m.month === month.month} onClick={() => setOpen(m.month)}>{monthName(lang, m.month)}</button>
            ))}
          </div>
          <div className="receipt-wrap">
            <section className="receipt" aria-labelledby="month-title">
              <h3 id="month-title">{monthName(lang, month.month)}</h3>
              <dl>
                <div><dt>{t('Smenalar')}</dt><dd>{month.shifts}</dd></div>
                <div><dt>{t('Ishlangan soat')}</dt><dd>{month.hours}</dd></div>
                <div><dt>{worker ? t('Topganingiz') : t('Ishchilarga to‘langan')}</dt><dd>{som(month.gross)}</dd></div>
                {worker && <div><dt>{t('Smena ulushi, {pct}%', { pct: SHARE * 100 })}</dt><dd>−{som(month.share)}</dd></div>}
                {worker && <div className="fee"><dt>{t('Qo‘lingizga')}</dt><dd>{som(month.net)}</dd></div>}
              </dl>
              <table className="report-table">
                <thead><tr><th>{t('Sana')}</th><th>{t('Smena')}</th><th className="num">{t('Haq')}</th></tr></thead>
                <tbody>
                  {month.items.map((i) => (
                    <tr key={i.id}>
                      <td>{day(i.date, false)}<br /><span className="muted">{i.start_time}–{i.end_time}</span></td>
                      <td>{i.title}<br /><span className="muted">{i.who}</span></td>
                      <td className="num">{som(i.pay)}{i.paid === 'no' ? <><br /><span className="text-red">{t('olinmagan')}</span></> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <section className="sheet report-total">
            <h2>{t('Hammasi bo‘lib')}</h2>
            <dl className="facts">
              <div><dt>{t('Smenalar')}</dt><dd>{data.total.shifts}</dd></div>
              <div><dt>{t('Ishlangan soat')}</dt><dd>{data.total.hours}</dd></div>
              <div><dt>{worker ? t('Topganingiz') : t('Ishchilarga to‘langan')}</dt><dd>{som(data.total.gross)}</dd></div>
              {worker && <div><dt>{t('Qo‘lingizga')}</dt><dd>{som(data.total.net)}</dd></div>}
            </dl>
            <p className="hint">{t('Har oyning boshida o‘tgan oy hisoboti Telegram’dagi botga ham keladi.')}</p>
          </section>
        </div>
      )}
    </>
  );
}
