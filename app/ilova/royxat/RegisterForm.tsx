'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import { GoogleButton, GoogleSignupForm, type GoogleSignup } from '@/components/app/google';
import { Field, PhoneInput, ProfileFields, useSubmit } from '@/components/app/parts';
import { api, type Me } from '@/lib/client';

export default function RegisterForm({ business }: { business: boolean }) {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  const [signup, setSignup] = useState<GoogleSignup | null>(null);
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const user = await api<Me>('/register', body);
    setMe(user);
    router.push(home(user));
  });

  if (signup) return <GoogleSignupForm signup={signup} business={business} onCancel={() => setSignup(null)} />;

  return (
    <>
      <h1>Ro‘yxatdan o‘tish</h1>
      <form className="form narrow" onSubmit={onSubmit}>
        <GoogleButton onSignup={setSignup} />
        <ProfileFields business={business} />
        <Field label="Telefon raqam"><PhoneInput /></Field>
        <Field label="Parol"><input type="password" name="password" required minLength={6} autoComplete="new-password" /></Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>Ro‘yxatdan o‘tish</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p>Hisobingiz bormi? <Link href="/ilova/kirish">Kiring</Link></p>
      </form>
    </>
  );
}
