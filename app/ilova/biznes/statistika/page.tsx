'use client';

import Link from 'next/link';
import { useGuard, useLoad } from '@/components/app/AppShell';
import { useT } from '@/components/Lang';

type Stats = {
  overview: { total_shifts: number; total_spent: number; total_workers: number; noshows: number };
  topWorkers: { id: number; name: string; phone: string; count: number }[];
};

export default function BiznesStatsPage() {
  const me = useGuard('business');
  const { t, som } = useT();
  const { data, error } = useLoad<Stats>('/biznes/stats');
  if (!me) return null;

  return (
    <>
      <Link className="back" href="/ilova/biznes">{t('Smenalarim')}</Link>
      <div className="head"><h1>{t('Biznes statistikasi')}</h1></div>
      {error && <p className="banner danger">{error}</p>}
      {data && (
        <>
          <div className="sheet">
            <dl className="facts">
              <div><dt>{t('Smenalar')}</dt><dd>{data.overview.total_shifts}</dd></div>
              <div><dt>{t('Ishchilarga to‘langan')}</dt><dd>{som(data.overview.total_spent)}</dd></div>
              <div><dt>{t('Bajarilgan ishlar')}</dt><dd>{data.overview.total_workers}</dd></div>
              <div><dt>{t('Kelmaganlar (noshow)')}</dt><dd>{data.overview.noshows}</dd></div>
            </dl>
          </div>
          <section className="sheet">
            <h2>{t('Top 5 ishchi')}</h2>
            <table className="report-table">
              <thead><tr><th>{t('Ism')}</th><th>{t('Smena')}</th></tr></thead>
              <tbody>
                {data.topWorkers.map((w) => (
                  <tr key={w.id}><td>{w.name}<br /><span className="muted">{w.phone}</span></td><td>{w.count}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
