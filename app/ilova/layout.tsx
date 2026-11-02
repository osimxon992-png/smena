import type { Metadata } from 'next';
import AppShell from '@/components/app/AppShell';
import { getT } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: { default: t('Ilova'), template: '%s: Smena' } };
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
