'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import { Field, PhoneInput, useSubmit } from '@/components/app/parts';
import { api, type Me } from '@/lib/client';

export default function RegisterForm({ business }: { business: boolean }) {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const user = await api<Me>('/register', body);
    setMe(user);
    router.push(home(user));
  });

  return (
    <>
      <h1>Ro‘yxatdan o‘tish</h1>
      <form className="form narrow" onSubmit={onSubmit}>
        <fieldset className="roles">
          <legend>Siz kimsiz?</legend>
          <label><input type="radio" name="role" value="worker" defaultChecked={!business} /><span>Ish qidiryapman</span></label>
          <label><input type="radio" name="role" value="business" defaultChecked={business} /><span>Menga ishchi kerak</span></label>
        </fieldset>
        <Field label="Ismingiz"><input name="name" required maxLength={60} autoComplete="name" /></Field>
        <Field label="Biznes nomi" className="org"><input name="org" maxLength={80} placeholder="Bahor to‘yxonasi" /></Field>
        <Field label="Telefon raqam"><PhoneInput /></Field>
        <Field label="Parol"><input type="password" name="password" required minLength={6} autoComplete="new-password" /></Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>Ro‘yxatdan o‘tish</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p>Hisobingiz bormi? <Link href="/ilova/kirish">Kiring</Link></p>
      </form>
    </>
  );
}
