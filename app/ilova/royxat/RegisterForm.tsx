'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import AuthAside from '@/components/app/AuthAside';
import { GoogleButton, GoogleSignupForm, type GoogleSignup } from '@/components/app/google';
import { Field, PhoneInput, ProfileFields, useSubmit } from '@/components/app/parts';
import { api, type Me } from '@/lib/client';

export default function RegisterForm({ business }: { business: boolean }) {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  const [signup, setSignup] = useState<GoogleSignup | null>(null);
  // Yon tomondagi hisob-kitob formadagi "Siz kimsiz?" tanloviga ergashadi
  const [role, setRole] = useState<Me['role']>(business ? 'business' : 'worker');
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const user = await api<Me>('/register', body);
    setMe(user);
    router.push(home(user));
  });
  const onRoleChange = (e: React.FormEvent) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'role') setRole(input.value as Me['role']);
  };

  return (
    <div className="auth">
      <div onChange={onRoleChange}>
        {signup ? <GoogleSignupForm signup={signup} business={role === 'business'} onCancel={() => setSignup(null)} /> : (
          <>
            <h1>Ro‘yxatdan o‘tish</h1>
            <form className="form narrow" onSubmit={onSubmit}>
              <GoogleButton onSignup={setSignup} />
              <ProfileFields business={role === 'business'} />
              <Field label="Telefon raqam"><PhoneInput /></Field>
              <Field label="Parol"><input type="password" name="password" required minLength={6} autoComplete="new-password" /></Field>
              <button className="btn btn-lg" type="submit" disabled={busy}>Ro‘yxatdan o‘tish</button>
              {error && <p className="form-error" role="alert">{error}</p>}
              <p>Hisobingiz bormi? <Link href="/ilova/kirish">Kiring</Link></p>
            </form>
          </>
        )}
      </div>
      <AuthAside role={role} />
    </div>
  );
}
