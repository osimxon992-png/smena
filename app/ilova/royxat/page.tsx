import type { Metadata } from 'next';
import { getT } from '@/lib/lang-server';
import RegisterForm from './RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('Ro‘yxatdan o‘tish') };
}

export default async function Register({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  const { rol } = await searchParams;
  return <RegisterForm business={rol === 'biznes'} />;
}
