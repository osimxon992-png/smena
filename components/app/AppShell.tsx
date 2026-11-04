'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import InstallButton from '@/components/InstallButton';
import Farbo from '@/components/Farbo';
import { LangSwitch, useT } from '@/components/Lang';
import { api, rememberRef, type Me } from '@/lib/client';
import Avatar from './Avatar';

type AppCtx = {
  me: Me | null;
  ready: boolean;
  setMe: (me: Me | null) => void;
  refreshMe: () => Promise<void>;
  toast: (text: string, isError?: boolean) => void;
};
const AppContext = createContext<AppCtx>(null!);
export const useApp = () => useContext(AppContext);
export const home = (me: Me | null) => (
  me && !me.complete ? '/ilova/profil' : me?.role === 'business' ? '/ilova/biznes' : '/ilova/smenalar'
);

// Sahifa faqat shu rol uchun: kirmagan bo'lsa kirishga, boshqa rol bo'lsa o'z bosh sahifasiga
export function useGuard(role: Me['role']) {
  const { me, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!me) router.replace('/ilova/kirish');
    else if (me.role !== role) router.replace(home(me));
  }, [ready, me, role, router]);
  return ready && me?.role === role ? me : null;
}

// API'dan ma'lumot yuklash va qayta yuklash
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (path) api<T>(path).then((d) => { setData(d); setError(''); }).catch((e: Error) => setError(e.message));
  }, [path]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

// Telegram Mini App: bot ichida ochilganda Telegram manzil oxiriga (#tgWebAppData=...) imzolangan ma'lumot qo'shadi.
// Sahifa almashganda manzildan yo'qoladi, shuning uchun sessiya davomida sessionStorage'da turadi
function telegramInitData() {
  try {
    const fresh = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData');
    if (fresh) sessionStorage.setItem('tg-init', fresh);
    return fresh || sessionStorage.getItem('tg-init') || '';
  } catch {
    return '';
  }
}
type TgApp = Me | { linked: boolean; registered?: boolean; phone?: string };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<{ text: string; isError: boolean; show: boolean }>({ text: '', isError: false, show: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const path = usePathname();
  const router = useRouter();
  const { t } = useT();

  const refreshMe = useCallback(() => api<Me | null>('/me').then(setMe).catch(() => {}), []);
  useEffect(() => { refreshMe().finally(() => setReady(true)); }, [path, refreshMe]);
  // Taklif havolasi (?ref=) ro'yxatgacha eslab qolinadi; Telegram ma'lumoti sahifa birinchi ochilganda olinadi
  const tgInit = useRef<string | null>(null);
  const [tgNote, setTgNote] = useState('');
  useEffect(() => { rememberRef(); tgInit.current = telegramInitData(); }, []);
  // Bot ichida: Telegram oynasini to'liq ochamiz va kirmagan bo'lsa, bog'langan raqam orqali parolsiz kiritamiz
  const tgTried = useRef(false);
  useEffect(() => {
    const init = tgInit.current;
    if (!ready || !init || tgTried.current) return;
    tgTried.current = true;
    const script = Object.assign(document.createElement('script'), { src: 'https://telegram.org/js/telegram-web-app.js', async: true });
    script.onload = () => {
      const app = (window as { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } }).Telegram?.WebApp;
      app?.ready();
      app?.expand();
    };
    document.head.append(script);
    if (me) return;
    api<TgApp>('/telegram/app', { initData: init }).then((r) => {
      if ('id' in r) {
        setMe(r);
        if (['/ilova/smenalar', '/ilova/kirish', '/ilova/royxat'].includes(location.pathname)) router.replace(home(r));
      } else if (!r.linked) {
        setTgNote(t('Raqamingiz botga bog‘lanmagan. Botga qaytib, “📱 Raqamni yuborish” tugmasini bosing — keyin Smena’ga o‘zi kirasiz.'));
      } else {
        setTgNote(t('Raqamingiz botga bog‘langan, lekin Smena’da hisobingiz yo‘q. Ro‘yxatdan o‘ting: kod shu Telegram chatiga keladi.'));
        router.push('/ilova/royxat');
      }
    }).catch((e: Error) => setTgNote(e.message));
  }, [ready, me, router, t]);
  // Ro'yxatdan o'tgandan keyin profil to'ldirilmaguncha ilovaning boshqa sahifalari ochilmaydi
  useEffect(() => { if (me && !me.complete && path !== '/ilova/profil') router.replace('/ilova/profil'); }, [me, path, router]);

  const toast = useCallback((text: string, isError = false) => {
    setNote({ text, isError, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote((n) => ({ ...n, show: false })), 3500);
  }, []);

  async function logout() {
    await api('/logout', {}).catch(() => {});
    // To'liq o'tish: aks holda himoyalangan sahifa me=null ni ko'rib, avval kirish sahifasiga yo'naltirib yuboradi
    location.assign('/ilova/smenalar');
  }

  const links = !me ? [['/ilova/smenalar', 'Smenalar'], ['/ilova/kirish', 'Kirish']]
    : me.role === 'worker' ? [['/ilova/smenalar', 'Smenalar'], ['/ilova/arizalarim', 'Arizalarim']]
    : [['/ilova/biznes', 'Smenalarim'], ['/ilova/yangi', 'Yangi smena'], ['/ilova/sevimlilar', 'Sevimlilar']];

  return (
    <AppContext.Provider value={{ me, ready, setMe, refreshMe, toast }}>
      <div className="app">
        <div className="wrap">
          <header className="top">
            <Link className="logo" href="/">Smena</Link>
            <nav aria-label={t('Ilova')}>
              {links.map(([href, text]) => (
                <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>{t(text)}</Link>
              ))}
              {me && (
                <Link className="nav-me" href="/ilova/profil" aria-current={path === '/ilova/profil' ? 'page' : undefined}>
                  <Avatar photo={me.photo} name={me.name} />{t('Profil')}
                </Link>
              )}
              <InstallButton className="link" />
              {me && <button type="button" className="link" onClick={logout}>{t('Chiqish')}</button>}
              <LangSwitch />
            </nav>
          </header>
          {tgNote && !me && <p className="banner tg-note">{tgNote}</p>}
          <main id="asosiy">{children}</main>
        </div>
        <Farbo />
        <div className={`toast${note.show ? ' show' : ''}${note.isError ? ' error' : ''}`} role="status" aria-live="polite">{note.text}</div>
      </div>
    </AppContext.Provider>
  );
}
