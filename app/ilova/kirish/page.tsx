'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import AuthAside from '@/components/app/AuthAside';
import { GoogleButton, GoogleSignupForm, type GoogleSignup } from '@/components/app/google';
import { Field, PhoneInput, useSubmit } from '@/components/app/parts';
import { BotHint, CodeForm, ErrorText, useCodeStep } from '@/components/app/sms';
import { api, type Me } from '@/lib/client';
import { useT } from '@/components/Lang';

const MODES = [['code', 'Telegram kod bilan'], ['password', 'Parol bilan']] as const;

export default function Login() {
  const { me, ready, setMe } = useApp();
  const router = useRouter();
  const [signup, setSignup] = useState<GoogleSignup | null>(null);
  const [role, setRole] = useState<Me['role']>('worker');
  // Ikki yo'l: Telegram botga kelgan kod yoki parol
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const sms = useCodeStep();
  const { t } = useT();
  useEffect(() => { if (ready && me) router.replace(home(me)); }, [ready, me, router]);
  const enter = (user: Me) => { setMe(user); router.push(home(user)); };
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    if (mode === 'password') return enter(await api<Me>('/login', body));
    // Raqam ro'yxatda bo'lsa, server Telegram'ga kod yuboradi
    const { phone } = await api<{ phone: string }>('/login/check', body);
    sms.start({ phone, finish: async (code) => enter(await api<Me>('/login/code', { phone, code })), resend: () => api('/login/check', body) });
  });

  return (
    <div className="auth">
      <div>
        {/* Google hisobi hali ro'yxatdan o'tmagan bo'lsa, shu yerning o'zida yakunlanadi */}
        {signup ? <GoogleSignupForm signup={signup} business={false} onCancel={() => setSignup(null)} /> : (
          <>
            {sms.step && <CodeForm step={sms.step} onBack={sms.cancel} />}
            <div hidden={!!sms.step}>
              <h1>{t('Kirish')}</h1>
              <form className="form narrow" onSubmit={onSubmit}>
                <GoogleButton onSignup={setSignup} />
                <div className="pick-row" role="group" aria-label={t('Kirish usuli')}>
                  {MODES.map(([m, label]) => (
                    <button key={m} type="button" className="pick" aria-pressed={m === mode} onClick={() => setMode(m)}>{t(label)}</button>
                  ))}
                </div>
                <Field label={t('Telefon raqam')}><PhoneInput /></Field>
                {mode === 'code' && <BotHint />}
                {mode === 'password' && <Field label={t('Parol')}><input type="password" name="password" required autoComplete="current-password" /></Field>}
                <button className="btn btn-lg" type="submit" disabled={busy}>{mode === 'code' ? t('Kod olish') : t('Kirish')}</button>
                {error && <ErrorText text={error} />}
                <p>{t('Hisobingiz yo‘qmi?')} <Link href="/ilova/royxat">{t('Ro‘yxatdan o‘ting')}</Link></p>
              </form>
            </div>
          </>
        )}
      </div>
      <AuthAside role={role} onRole={setRole} />
    </div>
  );
}
