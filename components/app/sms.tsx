'use client';

import { useEffect, useState } from 'react';
import { TELEGRAM_BOT } from '@/lib/options';
import { Field, useSubmit } from './parts';
import { useT } from '@/components/Lang';

// Telefon raqamni Telegram kodi bilan tasdiqlash. Kodni server yuboradi (ro'yxat yoki kirish tekshiruvi bilan birga):
// start() kod oynasini ochadi, CodeForm kodni so'raydi va finish(code) ni chaqiradi; resend() kodni qayta yuboradi
export type CodeStep = { phone: string; finish: (code: string) => Promise<unknown>; resend: () => Promise<unknown> };

export function useCodeStep() {
  const [step, setStep] = useState<CodeStep | null>(null);
  return { step, start: (s: CodeStep) => setStep(s), cancel: () => setStep(null) };
}

const pretty = (phone: string) => phone.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');
const RESEND_AFTER = 60;

// Raqam ostida doim ko'rinadigan eslatma: kod Telegram botga keladi
export function BotHint() {
  const { t } = useT();
  return (
    <p className="hint">
      {t('Tasdiqlash kodi Telegram’dagi botga keladi:')} <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a>.{' '}
      {t('Birinchi marta bo‘lsa, botni oching, /start bosing va “📱 Raqamni yuborish” tugmasini bosing.')}
    </p>
  );
}

// Xato matnidagi t.me/... manzilni bosiladigan havola qiladi
export function ErrorText({ text }: { text: string }) {
  const parts = text.split(/(t\.me\/\w+)/);
  return (
    <p className="form-error" role="alert">
      {parts.map((p, i) => (/^t\.me\//.test(p) ? <a key={i} href={`https://${p}`} target="_blank" rel="noreferrer">{p}</a> : p))}
    </p>
  );
}

export function CodeForm({ step, onBack }: { step: CodeStep; onBack: () => void }) {
  const [wait, setWait] = useState(RESEND_AFTER);
  const [resend, setResend] = useState({ busy: false, error: '', done: false });
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const { t } = useT();
  const { onSubmit, error, busy } = useSubmit(async ({ code }) => step.finish(code.trim()));

  async function again() {
    setResend({ busy: true, error: '', done: false });
    try {
      await step.resend();
      setWait(RESEND_AFTER);
      setResend({ busy: false, error: '', done: true });
    } catch (e) {
      setResend({ busy: false, error: (e as Error).message, done: false });
    }
  }

  return (
    <>
      <h1>{t('Raqamni tasdiqlang')}</h1>
      <form className="form narrow" onSubmit={onSubmit}>
        <p>
          {t('{phone} uchun 6 xonali kod Telegram’dagi botga yuborildi:', { phone: pretty(step.phone) })}{' '}
          <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a>
        </p>
        <Field label={t('Telegram kodi')}>
          <input className="code-input" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" />
        </Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>{t('Tasdiqlash')}</button>
        {(error || resend.error) && <ErrorText text={error || resend.error} />}
        <p className="hint" aria-live="polite">
          {resend.done && `${t('Yangi kod yuborildi.')} `}
          {wait > 0 ? t('Kod kelmasa, {n} soniyadan keyin qayta yuborish mumkin', { n: wait })
            : <button type="button" className="link" disabled={resend.busy} onClick={again}>{t('Kodni qayta yuborish')}</button>}
        </p>
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t('Raqamni o‘zgartirish')}</button>
      </form>
    </>
  );
}
