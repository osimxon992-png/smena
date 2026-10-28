'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void> };

// Brauzer o'rnatishni taklif qilsa ko'rinadi (Android Chrome, kompyuter Chrome/Edge)
export default function InstallButton({ className }: { className: string }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const offer = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const done = () => setEvt(null);
    addEventListener('beforeinstallprompt', offer);
    addEventListener('appinstalled', done);
    return () => { removeEventListener('beforeinstallprompt', offer); removeEventListener('appinstalled', done); };
  }, []);
  if (!evt) return null;
  return <button type="button" className={className} onClick={() => { evt.prompt(); setEvt(null); }}>Ilovani o‘rnatish</button>;
}
