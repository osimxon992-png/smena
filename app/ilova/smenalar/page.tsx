'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, Ticket } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { smoothScrollTo } from '@/components/SmoothScroll';
import { api, locate, STATUS, type Point, type Shift } from '@/lib/client';
import { REGIONS } from '@/lib/options';

// Xarita (Leaflet) faqat brauzerda va faqat "Xarita" tanlanganda yuklanadi
const ShiftMap = dynamic(() => import('@/components/app/Map').then((m) => m.ShiftMap), { ssr: false, loading: () => <div className="map map-loading" /> });

// Filtrlar manzilda ham turadi (?q=…&when=…): sahifani yangilasa yoki havolani ulashsa, tanlov saqlanadi.
// Joylashuvim esa manzilga yozilmaydi: havolani ulashganda u boshqalarga ketmasin
type Filters = { q: string; when: string; region: string; district: string; min_pay: string; sort: string; mine: string; urgent: string };
const EMPTY: Filters = { q: '', when: '', region: '', district: '', min_pay: '', sort: '', mine: '', urgent: '' };
type Brigade = { brigade: { name: string; mine: boolean; members: { joined: boolean }[] } | null };
const WHEN = [['', 'Istalgan kun'], ['today', 'Bugun'], ['tomorrow', 'Ertaga'], ['week', 'Shu hafta']];
const PAYS = [150000, 200000, 250000, 300000];

export default function OpenShifts() {
  const { me, refreshMe, toast } = useApp();
  const { t, som } = useT();
  const [f, setF] = useState<Filters>(EMPTY);
  const [text, setText] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [near, setNear] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState(0);
  const set = (patch: Partial<Filters>) => setF((old) => ({ ...old, ...patch }));

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const init = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, q.get(k) ?? ''])) as Filters;
    setF(init);
    setText(init.q);
  }, []);
  // Qidiruv yozilayotganda har harfda so'rov ketmasin
  useEffect(() => {
    const timer = setTimeout(() => setF((old) => (old.q === text.trim() ? old : { ...old, q: text.trim() })), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  useEffect(() => { history.replaceState(null, '', query ? `?${query}` : location.pathname); }, [query]);
  const apiQuery = [query, near && `near=${near.lat},${near.lng}`].filter(Boolean).join('&');
  const { data, error, reload } = useLoad<Shift[]>(`/shifts${apiQuery ? `?${apiQuery}` : ''}`);
  const active = Object.values(f).some(Boolean);
  // Brigada boshlig'iga "Brigada bilan" tugmasi: a'zolar soni bilan
  const { data: crew } = useLoad<Brigade>(me?.role === 'worker' ? '/brigade' : null);
  const team = crew?.brigade?.mine ? crew.brigade.members.filter((m) => m.joined).length : 0;

  async function findNear() {
    if (near) { setNear(null); return; }
    setLocating(true);
    try {
      setNear(await locate({ denied: t('Joylashuvga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering'), failed: t('Joylashuvni aniqlab bo‘lmadi. Qayta urinib ko‘ring') }));
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLocating(false);
    }
  }

  // Xaritada bosilgan smena kartochkasi ekran o'rtasiga keladi (sayt Lenis bilan aylanadi: scrollIntoView emas)
  function pick(id: number) {
    setPicked(id);
    const el = document.getElementById(`smena-${id}`);
    if (el) smoothScrollTo(el.getBoundingClientRect().top + scrollY - (innerHeight - el.offsetHeight) / 2);
  }

  async function applyTeam(s: Shift) {
    const res = await api<{ team: number; skipped: string[] }>(`/shifts/${s.id}/apply`, { brigade: true });
    reload();
    refreshMe();
    return res;
  }

  function action(s: Shift) {
    if (s.my_status) return <p className={`chip chip-${s.my_status}`}>{t(STATUS[s.my_status])}</p>;
    if (s.demo) return <p className="chip">{t('Demo smena: ariza qabul qilinmaydi')}</p>;
    if ((s.taken ?? 0) >= (s.slots ?? 0)) return <p className="chip">{t('Joy qolmadi')}</p>;
    if (!me) return <Link className="btn" href="/ilova/kirish">{t('Ariza berish uchun kiring')}</Link>;
    if (me.role !== 'worker' || me.blocked) return null;
    const free = (s.slots ?? 0) - (s.taken ?? 0);
    return (
      <>
        <ActionButton run={() => api(`/shifts/${s.id}/apply`, {}).then(() => { reload(); refreshMe(); })} done={t('Ariza yuborildi')}>{t('Ariza berish')}</ActionButton>
        {team > 1 && free >= team && (
          <ActionButton className="btn btn-line" run={() => applyTeam(s)}
            done={(r) => (r.skipped.length ? t('Brigada arizasi yuborildi: {n} kishi. Qo‘shilmadi: {names}', { n: r.team, names: r.skipped.join(', ') }) : t('Brigada arizasi yuborildi: {n} kishi', { n: r.team }))}>👥 {t('Brigada bilan ({n} kishi)', { n: team })}</ActionButton>
        )}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <h1>{t('Ochiq smenalar')}</h1>
        <div className="pick-row" role="group" aria-label={t('Ko‘rinish')}>
          <button type="button" className="pick" aria-pressed={view === 'list'} onClick={() => setView('list')}>☰ {t('Ro‘yxat')}</button>
          <button type="button" className="pick" aria-pressed={view === 'map'} onClick={() => setView('map')}>🗺 {t('Xarita')}</button>
        </div>
      </div>
      <BlockedBanner />
      <form className="filters sheet" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="sr" htmlFor="shift-q">{t('Smenalar ichidan qidirish')}</label>
        <input id="shift-q" className="search-input" type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t('Lavozim, biznes yoki manzil: masalan, ofitsiant')} autoComplete="off" maxLength={60} />
        <div className="pick-row" role="group" aria-label={t('Qaysi kuni')}>
          {WHEN.map(([v, label]) => (
            <button key={v} type="button" className="pick" aria-pressed={f.when === v} onClick={() => set({ when: v })}>{t(label)}</button>
          ))}
          <button type="button" className="pick pick-urgent" aria-pressed={f.urgent === '1'} onClick={() => set({ urgent: f.urgent ? '' : '1' })}>🔥 {t('Shoshilinch')}</button>
          <button type="button" className="pick" aria-pressed={!!near} disabled={locating} onClick={findNear}>
            📍 {locating ? t('Aniqlanmoqda…') : t('Yaqinimdagilar')}
          </button>
        </div>
        {near && <p className="hint">{t('Smenalar sizga yaqinligi bo‘yicha: eng yaqini birinchi. Joyi belgilanmaganlari oxirida.')}</p>}
        <div className="filters-row">
          <select aria-label={t('Viloyat')} value={f.region} onChange={(e) => set({ region: e.target.value, district: '' })}>
            <option value="">{t('Barcha viloyatlar')}</option>
            {Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}
          </select>
          <select aria-label={t('Tuman yoki shahar')} value={f.district} disabled={!f.region} onChange={(e) => set({ district: e.target.value })}>
            <option value="">{f.region ? t('Barcha tumanlar') : t('Avval viloyatni tanlang')}</option>
            {(REGIONS[f.region] ?? []).map((d) => <option key={d}>{d}</option>)}
          </select>
          <select aria-label={t('Eng kam haq')} value={f.min_pay} onChange={(e) => set({ min_pay: e.target.value })}>
            <option value="">{t('Har qanday haq')}</option>
            {PAYS.map((p) => <option key={p} value={p}>{t('{pay} dan', { pay: som(p) })}</option>)}
          </select>
          <select aria-label={t('Tartib')} value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="">{t('Avval yaqinlari')}</option>
            <option value="pay">{t('Avval qimmatlari')}</option>
          </select>
        </div>
        <div className="filters-foot">
          {me?.role === 'worker' && (
            <label className="check"><input type="checkbox" checked={f.mine === '1'} onChange={(e) => set({ mine: e.target.checked ? '1' : '' })} /> {t('Ko‘nikmalarimga mos')}</label>
          )}
          <span className="muted" aria-live="polite">{data ? t('{n} ta smena', { n: data.length }) : ''}</span>
          {active && <button type="button" className="link" onClick={() => { setF(EMPTY); setText(''); }}>{t('Filtrni tozalash')}</button>}
        </div>
      </form>
      {error && <p className="banner danger">{error}</p>}
      {view === 'map' && data && <ShiftMap shifts={data} me={near} onPick={pick} />}
      {data && (data.length
        ? <div className="tickets">{data.map((s) => <Ticket key={s.id} s={s} picked={picked === s.id}>{action(s)}</Ticket>)}</div>
        : active
          ? <Empty title={t('Bunday smena topilmadi')}>{t('Filtrni o‘zgartiring yoki tozalang.')}</Empty>
          : <Empty title={t('Hozircha ochiq smena yo‘q')}>{t('Yangi smenalar har kuni qo‘shiladi. Kechroq qaytib ko‘ring.')}</Empty>)}
    </>
  );
}
