'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type Me } from '@/lib/client';
import { googleIdToken, preloadFirebase } from '@/lib/firebase';
import { home, useApp } from './AppShell';
import { Field, PhoneInput, ProfileFields, useSubmit } from './parts';
import { SmsCodeForm, useSmsStep } from './sms';

export type GoogleSignup = { idToken: string; name: string };

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

// Hisob bo'lsa darhol kiradi; birinchi marta bo'lsa onSignup bilan ro'yxatni yakunlash formasiga o'tadi
export function GoogleButton({ onSignup }: { onSignup: (s: GoogleSignup) => void }) {
  const { setMe } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { preloadFirebase().catch(() => {}); }, []);

  async function click() {
    setBusy(true);
    setError('');
    try {
      const idToken = await googleIdToken();
      if (!idToken) return;
      const res = await api<Me | { signup: { name: string } }>('/google', { idToken });
      if ('signup' in res) {
        onSignup({ idToken, name: res.signup.name });
      } else {
        setMe(res);
        router.push(home(res));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-line btn-lg btn-google" disabled={busy} onClick={click}><GoogleLogo /> Google orqali kirish</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="or">yoki telefon raqam bilan</p>
    </>
  );
}

// Google tasdiqlagandan keyin: rol, ism va telefon (parol kerak emas, telefon SMS kod bilan tasdiqlanadi)
export function GoogleSignupForm({ signup, business, onCancel }: { signup: GoogleSignup; business: boolean; onCancel: () => void }) {
  const { setMe } = useApp();
  const router = useRouter();
  const sms = useSmsStep();
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const { phone } = await api<{ phone: string }>('/register/check', { ...body, google: true });
    await sms.start(phone, async (phoneToken) => {
      const user = await api<Me>('/google', { ...body, idToken: signup.idToken, phoneToken });
      setMe(user);
      router.push(home(user));
    });
  });

  return (
    <>
      {sms.step && <SmsCodeForm step={sms.step} onBack={sms.cancel} />}
      {/* Kod kutilayotganda forma yashirinadi, lekin yo'qolmaydi: "Raqamni o'zgartirish" bosilsa, kiritilganlar joyida */}
      <div hidden={!!sms.step}>
        <h1>Ro‘yxatni yakunlash</h1>
        <form className="form narrow" onSubmit={onSubmit}>
          <p>Google hisobingiz tasdiqlandi. Telefon raqamingizga tasdiqlash kodi keladi; raqam smenaga qabul qilingandan keyin ikkinchi tomonga ko‘rinadi.</p>
          <ProfileFields business={business} name={signup.name} />
          <Field label="Telefon raqam"><PhoneInput /></Field>
          <button className="btn btn-lg" type="submit" disabled={busy}>Kod olish</button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-ghost" type="button" onClick={onCancel}>Orqaga</button>
        </form>
      </div>
    </>
  );
}
