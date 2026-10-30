'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import { GoogleButton, GoogleSignupForm, type GoogleSignup } from '@/components/app/google';
import { Field, PhoneInput, useSubmit } from '@/components/app/parts';
import { api, type Me } from '@/lib/client';

export default function Login() {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  const [signup, setSignup] = useState<GoogleSignup | null>(null);
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const user = await api<Me>('/login', body);
    setMe(user);
    router.push(home(user));
  });

  // Google hisobi hali ro'yxatdan o'tmagan bo'lsa, shu yerning o'zida yakunlanadi
  if (signup) return <GoogleSignupForm signup={signup} business={false} onCancel={() => setSignup(null)} />;

  return (
    <>
      <h1>Kirish</h1>
      <form className="form narrow" onSubmit={onSubmit}>
        <GoogleButton onSignup={setSignup} />
        <Field label="Telefon raqam"><PhoneInput /></Field>
        <Field label="Parol"><input type="password" name="password" required autoComplete="current-password" /></Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>Kirish</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p>Hisobingiz yo‘qmi? <Link href="/ilova/royxat">Ro‘yxatdan o‘ting</Link></p>
      </form>
    </>
  );
}
