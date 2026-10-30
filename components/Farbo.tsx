'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, day, som, type Me, type Shift } from '@/lib/client';

// Farbo — ovozli AI yordamchi. Uch yo'l bilan so'raladi: yozib, mikrofon tugmasi bilan gapirib,
// yoki "Farbo deb chaqirish" yoqilgan bo'lsa "Salom Farbo, bugungi ishlarni ayt" deb. Javob ovoz bilan o'qiladi.
// Admin panelida javobdagi foydalanuvchi va smenalar: bosilsa panelning kartochkasi ochiladi
type Ref = { kind: 'user' | 'shift'; id: number; label: string; sub: string };
// speech: javobning ovoz uchun nusxasi (raqamlar o'zbekcha so'z bilan)
type Msg = { role: 'user' | 'model'; text: string; speech?: string; shifts?: Shift[]; link?: string; refs?: Ref[] };
// left: bugun qolgan savollar (tarif bo'yicha; mehmon va admin uchun null)
type Answer = { heard: string; reply: string; speech?: string; shifts?: Shift[]; link?: string; refs?: Ref[]; left?: number | null };

const MAX_SECONDS = 20;
// Brauzer "Farbo" ni turlicha eshitishi mumkin: farba, farbu, parbo, farrbo, фарбо (\b kirill harflarida ishlamaydi)
const WAKE = /(?:^|[\s,.!?])([fp]ar+b[oau]|фар+б[оау])(?=$|[\s,.!?])[\s,.!?]*/i;
const LINKS: Record<string, string> = {
  '/ilova/smenalar': 'Smenalar', '/ilova/arizalarim': 'Arizalarim', '/ilova/biznes': 'Smenalarim', '/ilova/yangi': 'Yangi smena',
  '/ilova/profil': 'Profil', '/qoidalar': 'Qoidalar', '/savollar': 'Savollar', '/bizneslar': 'Bizneslar uchun',
};
const CHIPS = {
  guest: ['Bugungi smenalar', 'Ertaga qanday ish bor?', 'Smena qanday ishlaydi?'],
  worker: ['Bugungi ishlarni ayt', 'Arizalarim qanday?', '200 ming smenadan qo‘limga qancha qoladi?'],
  business: ['Yangi arizalar bormi?', 'Smenalarim holati', 'Qanday smena e’lon qilay?'],
  admin: ['Bugun nima bo‘ldi?', 'Kimlar bloklangan?', 'Jami komissiya qancha?', 'Qaysi biznes eng faol?'],
};

// Yozilgan ovozni (webm/ogg) 16 kHz mono WAV ga aylantiradi: Gemini WAV ni tushunadi
async function toWav(blob: Blob) {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const samples = (await ctx.decodeAudioData(await blob.arrayBuffer())).getChannelData(0);
    const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
    const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
    view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, samples.length * 2, true);
    samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    const bytes = new Uint8Array(view.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } finally {
    ctx.close();
  }
}

const recognition = () => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRec) | undefined ?? null;
};
type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

function ShiftCard({ s, me }: { s: Shift; me: Me | null }) {
  const [state, setState] = useState<{ busy: boolean; done: string; error: string }>({ busy: false, done: '', error: '' });
  const left = (s.slots ?? 0) - (s.taken ?? 0);
  async function apply() {
    setState({ busy: true, done: '', error: '' });
    try {
      await api(`/shifts/${s.id}/apply`, {});
      setState({ busy: false, done: 'Ariza yuborildi', error: '' });
    } catch (e) {
      setState({ busy: false, done: '', error: (e as Error).message });
    }
  }
  return (
    <div className="farbo-shift">
      <p><b>{s.title}</b> · {s.org}</p>
      <p className="farbo-when">{day(s.date)}, {s.start_time}–{s.end_time}</p>
      <p className="farbo-pay">{som(s.pay)} <span>{left > 0 ? `${left} joy` : 'joy yo‘q'}</span></p>
      {s.demo ? <p className="farbo-ok">Demo smena: ariza qabul qilinmaydi</p>
        : !me ? <Link className="btn btn-line" href="/ilova/kirish">Ariza uchun kiring</Link>
        : me.role === 'worker' && !s.my_status && !state.done && left > 0
          ? <button type="button" className="btn" disabled={state.busy} onClick={apply}>Ariza berish</button>
          : null}
      {(state.done || s.my_status) && <p className="farbo-ok">{state.done || 'Ariza berilgan'}</p>}
      {state.error && <p className="form-error">{state.error}</p>}
    </div>
  );
}

// admin berilsa — admin paneli rejimi: butun platforma bo'yicha savollar (/api/admin/ai), limitsiz
export default function Farbo({ admin }: { admin?: { onOpen: (target: { kind: Ref['kind']; id: number }) => void } }) {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const [rec, setRec] = useState(0); // yozilayotgan soniyalar; 0 = yozilmayapti
  const [speakOn, setSpeakOn] = useState(true);
  const [wake, setWake] = useState(false);
  const [canWake, setCanWake] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const listener = useRef<SpeechRec | null>(null);
  const armed = useRef(0); // "Farbo" deyilib, savol kutilayotgan vaqt chegarasi
  const speaking = useRef(false);
  const wakeRef = useRef(false);
  // "Farbo" tinglagichi bir marta yaratiladi: u ichida eng so'nggi holatni ref orqali o'qiymiz
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const speakRef = useRef(speakOn);
  speakRef.current = speakOn;

  useEffect(() => {
    setCanWake(!!recognition());
    try { setSpeakOn(localStorage.getItem('farbo-ovoz') !== '0'); } catch { /* xotira yopiq */ }
  }, []);
  const adminMode = !!admin;
  useEffect(() => { if (!adminMode && (open || wake)) api<Me | null>('/me').then(setMe).catch(() => {}); }, [adminMode, open, wake]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);

  // Javobni o'qiydi: Gemini ovozi, bo'lmasa brauzerning o'z ovozi. O'qiyotganda "Farbo" tinglash to'xtaydi (o'zini eshitmasin)
  async function say(text: string) {
    speaking.current = true;
    listener.current?.stop();
    const done = () => { speaking.current = false; if (wakeRef.current) startListening(); };
    try {
      const res = await fetch('/api/ai/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error();
      player.current?.pause();
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      player.current = audio;
      audio.onended = done;
      await audio.play();
    } catch {
      // Brauzer ovozi faqat o'zbekcha ovoz o'rnatilgan bo'lsa (masalan Edge'dagi Madina/Sardor).
      // Aks holda u o'zbekcha matnni inglizcha talaffuz bilan o'qiydi: undan ko'ra jim turgan yaxshi
      const voice = 'speechSynthesis' in window ? speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('uz')) : undefined;
      if (voice) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.onend = done;
        speechSynthesis.speak(u);
      } else {
        setNote('Ovoz hozir mavjud emas (limit tugagan bo‘lishi mumkin). Javob yozuvda turibdi');
        done();
      }
    }
  }

  async function ask(payload: { text?: string; audio?: string }) {
    const history = msgsRef.current.slice(-8).map(({ role, text }) => ({ role, text }));
    setOpen(true);
    setNote('');
    setBusy(true);
    setMsgs((m) => [...m, { role: 'user', text: payload.text ?? '🎤 …' }]);
    try {
      const a = await api<Answer>(admin ? '/admin/ai' : '/ai', { ...payload, history });
      setMsgs((m) => {
        const next = [...m];
        if (payload.audio) next[next.length - 1] = { role: 'user', text: a.heard ? `🎤 ${a.heard}` : '🎤 (ovozli xabar)' };
        return [...next, { role: 'model', text: a.reply, speech: a.speech, shifts: a.shifts, link: a.link, refs: a.refs }];
      });
      setLeft(a.left ?? null);
      if (speakRef.current) say(a.speech || a.reply);
    } catch (e) {
      setNote((e as Error).message);
      setMsgs((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recorder.current) return recorder.current.stop();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setNote('Mikrofonga ruxsat bering: manzil qatoridagi qulf belgisi orqali');
    }
    player.current?.pause();
    const r = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    let seconds = 0;
    const tick = setInterval(() => { seconds += 1; setRec(seconds + 1); if (seconds >= MAX_SECONDS) r.stop(); }, 1000);
    r.ondataavailable = (e) => chunks.push(e.data);
    r.onstop = async () => {
      clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      setRec(0);
      const blob = new Blob(chunks, { type: r.mimeType });
      if (blob.size < 2000) return setNote('Ovoz eshitilmadi. Tugmani bosib, gapirib, yana bosing');
      try { await ask({ audio: await toWav(blob) }); } catch { setNote('Ovozni o‘qib bo‘lmadi. Yozib so‘rang'); }
    };
    recorder.current = r;
    r.start();
    setRec(1);
  }

  // "Farbo" deb chaqirish: brauzerning nutqni tanish xizmati doim tinglaydi va "Farbo" so'zini kutadi
  function startListening() {
    const SR = recognition();
    if (!SR || speaking.current) return;
    const r = new SR();
    r.lang = 'uz-UZ';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const heard = e.results[e.results.length - 1][0].transcript.trim();
      if (armed.current > Date.now()) { armed.current = 0; return void ask({ text: heard }); }
      const m = WAKE.exec(heard);
      if (!m) return;
      const rest = heard.slice(m.index + m[0].length).trim();
      if (rest.length > 2) return void ask({ text: rest });
      armed.current = Date.now() + 8000;
      setOpen(true);
      setNote('Eshitaman…');
    };
    r.onerror = (e) => {
      if (['not-allowed', 'service-not-allowed', 'language-not-supported'].includes(e.error)) {
        wakeRef.current = false;
        setWake(false);
        setNote(e.error === 'language-not-supported' ? 'Bu brauzer o‘zbek tilini tanimaydi. Mikrofon tugmasidan foydalaning' : 'Mikrofonga ruxsat bering');
      }
    };
    // Brauzer tinglashni vaqti-vaqti bilan to'xtatadi: yoqilgan bo'lsa qayta boshlaymiz
    r.onend = () => { if (listener.current === r) listener.current = null; if (wakeRef.current && !speaking.current) setTimeout(startListening, 300); };
    listener.current = r;
    try { r.start(); } catch { /* allaqachon tinglayapti */ }
  }
  function toggleWake(on: boolean) {
    wakeRef.current = on;
    setWake(on);
    setNote(on ? '“Farbo, …” deb gapiring' : '');
    if (on) startListening();
    else listener.current?.stop();
  }
  useEffect(() => () => { wakeRef.current = false; listener.current?.stop(); player.current?.pause(); }, []);

  function setSpeak(on: boolean) {
    setSpeakOn(on);
    if (!on) player.current?.pause();
    try { localStorage.setItem('farbo-ovoz', on ? '1' : '0'); } catch { /* xotira yopiq */ }
  }

  const chips = CHIPS[admin ? 'admin' : me?.role ?? 'guest'];

  return (
    <>
      <button type="button" className={`farbo-fab${wake ? ' live' : ''}`} aria-expanded={open} aria-controls="farbo" onClick={() => setOpen((o) => !o)}>
        <span className="farbo-dot" aria-hidden="true" />Farbo{wake && <span className="farbo-live">tinglayapman</span>}
      </button>
      {open && (
        <section id="farbo" className="farbo" role="dialog" aria-label="Farbo — ovozli yordamchi">
          <header className="farbo-head">
            <p><b>Farbo</b> <span>ovozli yordamchi</span></p>
            <button type="button" className="link" aria-label="Yopish" onClick={() => setOpen(false)}>✕</button>
          </header>
          <div className="farbo-log" ref={log} aria-live="polite">
            {msgs.length === 0 && (
              <div className="farbo-hello">
                <p>{admin
                  ? 'Salom! Men Farbo, admin yordamchisi. Platforma holati, foydalanuvchilar, smenalar, arizalar va komissiya haqida so‘rang: yozing yoki mikrofonni bosib gapiring.'
                  : `Salom${me ? `, ${me.first_name || me.name.split(' ')[0]}` : ''}! Men Farbo. Bugungi smenalar, arizalaringiz yoki qoidalar haqida so‘rang: yozing yoki mikrofonni bosib gapiring.`}</p>
                <div className="farbo-chips">
                  {chips.map((c) => <button key={c} type="button" disabled={busy} onClick={() => ask({ text: c })}>{c}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`farbo-msg ${m.role}`}>
                <p>{m.text}</p>
                {m.shifts?.map((s) => <ShiftCard key={s.id} s={s} me={me} />)}
                {m.link && <Link className="farbo-link" href={m.link} onClick={() => setOpen(false)}>{LINKS[m.link] ?? m.link} →</Link>}
                {m.refs?.map((r) => (
                  <button key={`${r.kind}${r.id}`} type="button" className="farbo-ref" onClick={() => { admin?.onOpen({ kind: r.kind, id: r.id }); setOpen(false); }}>
                    <b>{r.label}</b><span>{r.sub}</span>
                  </button>
                ))}
                {m.role === 'model' && <button type="button" className="farbo-replay" aria-label="Qayta eshitish" onClick={() => say(m.speech || m.text)}>🔊</button>}
              </div>
            ))}
            {busy && <p className="farbo-typing">Farbo o‘ylayapti…</p>}
          </div>
          {note && (
            <p className="farbo-note" role="status">
              {note}{/Pro obuna/.test(note) && <> <Link href="/ilova/profil#obuna" onClick={() => setOpen(false)}>Obuna haqida →</Link></>}
            </p>
          )}
          <form className="farbo-input" onSubmit={(e) => { e.preventDefault(); if (input.trim() && !busy) { ask({ text: input.trim() }); setInput(''); } }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={rec ? `Gapiring… ${rec}/${MAX_SECONDS} s` : 'Savolingizni yozing…'} aria-label="Savol" maxLength={1000} disabled={!!rec} />
            <button type="button" className={`farbo-mic${rec ? ' on' : ''}`} disabled={busy} onClick={toggleRecording} aria-label={rec ? 'Yozishni to‘xtatish va yuborish' : 'Gapirish'}>
              {rec ? '■' : '🎤'}
            </button>
            <button type="submit" className="btn" disabled={busy || !input.trim()}>Yuborish</button>
          </form>
          <div className="farbo-opts">
            <label><input type="checkbox" checked={speakOn} onChange={(e) => setSpeak(e.target.checked)} /> Javobni ovoz bilan o‘qish</label>
            {canWake && <label><input type="checkbox" checked={wake} onChange={(e) => toggleWake(e.target.checked)} /> “Farbo” deb chaqirish</label>}
            {left !== null && <span className="farbo-left">Bugun yana {left} ta savol</span>}
          </div>
        </section>
      )}
    </>
  );
}
