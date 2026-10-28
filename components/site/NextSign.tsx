import Link from 'next/link';
import ShareSheet from './ShareSheet';

export default function NextSign({ href, label = 'Keyingisi', title, tone }: { href: string; label?: string; title: string; tone: 'paper' | 'teal' | 'ink' }) {
  return (
    <nav className="next wrap" aria-label="Keyingi sahifa">
      <Link className={`next-sign stall-${tone}`} href={href}><span>{label}</span><strong>{title}</strong></Link>
      <ShareSheet />
    </nav>
  );
}
