'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import InstallButton from '@/components/InstallButton';
import Farbo from '@/components/Farbo';
import { api, type Me } from '@/lib/client';
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState<{ text: string; isError: boolean; show: boolean }>({ text: '', isError: false, show: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const path = usePathname();
  const router = useRouter();

  const refreshMe = useCallback(() => api<Me | null>('/me').then(setMe).catch(() => {}), []);
  useEffect(() => { refreshMe().finally(() => setReady(true)); }, [path, refreshMe]);
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
    : [['/ilova/biznes', 'Smenalarim'], ['/ilova/yangi', 'Yangi smena']];

  return (
    <AppContext.Provider value={{ me, ready, setMe, refreshMe, toast }}>
      <div className="app">
        <div className="wrap">
          <header className="top">
            <Link className="logo" href="/">Smena</Link>
            <nav aria-label="Ilova">
              {links.map(([href, text]) => (
                <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>{text}</Link>
              ))}
              {me && (
                <Link className="nav-me" href="/ilova/profil" aria-current={path === '/ilova/profil' ? 'page' : undefined}>
                  <Avatar photo={me.photo} name={me.name} />Profil
                </Link>
              )}
              <InstallButton className="link" />
              {me && <button type="button" className="link" onClick={logout}>Chiqish</button>}
            </nav>
          </header>
          <main id="asosiy">{children}</main>
        </div>
        <Farbo />
        <div className={`toast${note.show ? ' show' : ''}${note.isError ? ' error' : ''}`} role="status" aria-live="polite">{note.text}</div>
      </div>
    </AppContext.Provider>
  );
}
