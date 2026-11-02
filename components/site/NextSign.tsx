import Link from 'next/link';
import { getT } from '@/lib/lang-server';
import ShareSheet from './ShareSheet';

export default async function NextSign({ href, label, title, tone }: { href: string; label?: string; title: string; tone: 'paper' | 'teal' | 'ink' }) {
  const { t } = await getT();
  return (
    <nav className="next wrap" aria-label={t('Keyingi sahifa')}>
      <Link className={`next-sign stall-${tone}`} href={href}><span>{label ?? t('Keyingisi')}</span><strong>{title}</strong></Link>
      <ShareSheet />
    </nav>
  );
}
