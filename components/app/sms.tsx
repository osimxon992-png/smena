'use client';

import { useEffect, useState } from 'react';
import { confirmSmsCode, preloadFirebase, sendSmsCode, type ConfirmationResult } from '@/lib/firebase';
import { Field, useSubmit } from './parts';

// Telefon raqamni SMS kod bilan tasdiqlash: start() kod yuboradi, SmsCodeForm kodni so'raydi,
// kod to'g'ri bo'lsa finish() server tekshiradigan token bilan chaqiriladi
export type SmsStep = { phone: string; sent: ConfirmationResult; finish: (phoneToken: string) => Promise<unknown> };

export function useSmsStep() {
  const [step, setStep] = useState<SmsStep | null>(null);
  useEffect(() => { preloadFirebase().catch(() => {}); }, []);
  return {
    step,
    start: async (phone: string, finish: SmsStep['finish']) => setStep({ phone, sent: await sendSmsCode(phone), finish }),
    cancel: () => setStep(null),
  };
}

const pretty = (phone: string) => phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');
const RESEND_AFTER = 60;

export function SmsCodeForm({ step, onBack }: { step: SmsStep; onBack: () => void }) {
  const [sent, setSent] = useState(step.sent);
  const [wait, setWait] = useState(RESEND_AFTER);
  const [resend, setResend] = useState({ busy: false, error: '' });
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const { onSubmit, error, busy } = useSubmit(async ({ code }) => step.finish(await confirmSmsCode(sent, code.trim())));

  async function again() {
    setResend({ busy: true, error: '' });
    try {
      setSent(await sendSmsCode(step.phone));
      setWait(RESEND_AFTER);
      setResend({ busy: false, error: '' });
    } catch (e) {
      setResend({ busy: false, error: (e as Error).message });
    }
  }

  return (
    <>
      <h1>Raqamni tasdiqlang</h1>
      <form className="form narrow" onSubmit={onSubmit}>
        <p><strong>{pretty(step.phone)}</strong> raqamiga SMS orqali 6 xonali kod yuborildi.</p>
        <Field label="SMS kod">
          <input className="code-input" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" />
        </Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>Tasdiqlash</button>
        {(error || resend.error) && <p className="form-error" role="alert">{error || resend.error}</p>}
        <p className="hint" aria-live="polite">
          {wait > 0 ? `Kod kelmasa, ${wait} soniyadan keyin qayta yuborish mumkin`
            : <button type="button" className="link" disabled={resend.busy} onClick={again}>Kodni qayta yuborish</button>}
        </p>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Raqamni o‘zgartirish</button>
      </form>
    </>
  );
}
