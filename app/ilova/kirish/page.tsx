'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import AuthAside from '@/components/app/AuthAside';
import { GoogleButton, GoogleSignupForm, type GoogleSignup } from '@/components/app/google';
import { Field, PhoneInput, useSubmit } from '@/components/app/parts';
import { SmsCodeForm, useSmsStep } from '@/components/app/sms';
import { api, type Me } from '@/lib/client';

const MODES = [['sms', 'SMS kod bilan'], ['password', 'Parol bilan']] as const;

export default function Login() {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  const [signup, setSignup] = useState<GoogleSignup | null>(null);
  const [role, setRole] = useState<Me['role']>('worker');
  // Ikki yo'l: telefonga kelgan kod yoki parol
  const [mode, setMode] = useState<'sms' | 'password'>('sms');
  const sms = useSmsStep();
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const enter = (user: Me) => { setMe(user); router.push(home(user)); };
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    if (mode === 'password') return enter(await api<Me>('/login', body));
    // Raqam ro'yxatda bo'lsagina SMS yuboriladi
    const { phone } = await api<{ phone: string }>('/login/check', body);
    await sms.start(phone, async (phoneToken) => enter(await api<Me>('/login/sms', { phoneToken })));
  });

  return (
    <div className="auth">
      <div>
        {/* Google hisobi hali ro'yxatdan o'tmagan bo'lsa, shu yerning o'zida yakunlanadi */}
        {signup ? <GoogleSignupForm signup={signup} business={false} onCancel={() => setSignup(null)} /> : (
          <>
            {sms.step && <SmsCodeForm step={sms.step} onBack={sms.cancel} />}
            <div hidden={!!sms.step}>
              <h1>Kirish</h1>
              <form className="form narrow" onSubmit={onSubmit}>
                <GoogleButton onSignup={setSignup} />
                <div className="pick-row" role="group" aria-label="Kirish usuli">
                  {MODES.map(([m, label]) => (
                    <button key={m} type="button" className="pick" aria-pressed={m === mode} onClick={() => setMode(m)}>{label}</button>
                  ))}
                </div>
                <Field label="Telefon raqam"><PhoneInput /></Field>
                {mode === 'password' && <Field label="Parol"><input type="password" name="password" required autoComplete="current-password" /></Field>}
                <button className="btn btn-lg" type="submit" disabled={busy}>{mode === 'sms' ? 'Kod olish' : 'Kirish'}</button>
                {error && <p className="form-error" role="alert">{error}</p>}
                <p>Hisobingiz yo‘qmi? <Link href="/ilova/royxat">Ro‘yxatdan o‘ting</Link></p>
              </form>
            </div>
          </>
        )}
      </div>
      <AuthAside role={role} onRole={setRole} />
    </div>
  );
}
