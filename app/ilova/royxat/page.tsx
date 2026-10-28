import RegisterForm from './RegisterForm';

export const metadata = { title: 'Ro‘yxatdan o‘tish' };

export default async function Register({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  const { rol } = await searchParams;
  return <RegisterForm business={rol === 'biznes'} />;
}
