'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { dayName, LANG_LABEL, LANG_SHORT, LANGS, money, translate, type Lang, type Vars } from '@/lib/i18n';
import { UI } from '@/lib/ui';

// Tanlangan til butun sahifaga: ildiz layout uni "lang" cookie'sidan o'qib beradi
const LangContext = createContext<Lang>('uz');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

// t — matn tarjimasi (kalit o'zbekchasi), som — pul, day — sana ("Bugun", "Ertaga", "5-noyabr, chorshanba")
export function useT() {
  const lang = useContext(LangContext);
  return useMemo(() => ({
    lang,
    t: (key: string, vars?: Vars) => translate(UI, lang, key, vars),
    som: (n: number) => money(lang, n),
    day: (iso: string, withWeekday = true) => dayName(lang, iso, withWeekday),
  }), [lang]);
}

// Til tanlagich: server cookie'ni yozadi (kirgan bo'lsa — hisobga ham, Telegram xabarlari shu tilda), keyin sahifa yangi tilda qayta chiziladi
export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pick(next: Lang) {
    if (next === lang || busy) return;
    setBusy(true);
    try {
      await api('/lang', { lang: next });
      router.refresh();
    } catch {
      // Server javob bermasa ham til almashsin: cookie'ni o'zimiz yozamiz
      document.cookie = `lang=${next}; path=/; max-age=${365 * 86400}; samesite=lax`;
      location.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('Til')}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === lang} title={LANG_LABEL[l]} disabled={busy} onClick={() => pick(l)}>{LANG_SHORT[l]}</button>
      ))}
    </div>
  );
}
