'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp, useLoad } from '@/components/app/AppShell';
import { ActionButton, BlockedBanner, Empty, Ticket } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, STATUS, type Shift } from '@/lib/client';
import { REGIONS } from '@/lib/options';

// Filtrlar manzilda ham turadi (?q=…&when=…): sahifani yangilasa yoki havolani ulashsa, tanlov saqlanadi
type Filters = { q: string; when: string; region: string; district: string; min_pay: string; sort: string; mine: string };
const EMPTY: Filters = { q: '', when: '', region: '', district: '', min_pay: '', sort: '', mine: '' };
const WHEN = [['', 'Istalgan kun'], ['today', 'Bugun'], ['tomorrow', 'Ertaga'], ['week', 'Shu hafta']];
const PAYS = [150000, 200000, 250000, 300000];

export default function OpenShifts() {
  const { me, refreshMe } = useApp();
  const { t, som } = useT();
  const [f, setF] = useState<Filters>(EMPTY);
  const [text, setText] = useState('');
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
  const { data, error, reload } = useLoad<Shift[]>(`/shifts${query ? `?${query}` : ''}`);
  const active = Object.values(f).some(Boolean);

  function action(s: Shift) {
    if (s.my_status) return <p className={`chip chip-${s.my_status}`}>{t(STATUS[s.my_status])}</p>;
    if (s.demo) return <p className="chip">{t('Demo smena: ariza qabul qilinmaydi')}</p>;
    if ((s.taken ?? 0) >= (s.slots ?? 0)) return <p className="chip">{t('Joy qolmadi')}</p>;
    if (!me) return <Link className="btn" href="/ilova/kirish">{t('Ariza berish uchun kiring')}</Link>;
    if (me.role !== 'worker' || me.blocked) return null;
    return <ActionButton run={() => api(`/shifts/${s.id}/apply`, {}).then(() => { reload(); refreshMe(); })} done={t('Ariza yuborildi')}>{t('Ariza berish')}</ActionButton>;
  }

  return (
    <>
      <h1>{t('Ochiq smenalar')}</h1>
      <BlockedBanner />
      <form className="filters sheet" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="sr" htmlFor="shift-q">{t('Smenalar ichidan qidirish')}</label>
        <input id="shift-q" className="search-input" type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t('Lavozim, biznes yoki manzil: masalan, ofitsiant')} autoComplete="off" maxLength={60} />
        <div className="pick-row" role="group" aria-label={t('Qaysi kuni')}>
          {WHEN.map(([v, label]) => (
            <button key={v} type="button" className="pick" aria-pressed={f.when === v} onClick={() => set({ when: v })}>{t(label)}</button>
          ))}
        </div>
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
      {data && (data.length
        ? <div className="tickets">{data.map((s) => <Ticket key={s.id} s={s}>{action(s)}</Ticket>)}</div>
        : active
          ? <Empty title={t('Bunday smena topilmadi')}>{t('Filtrni o‘zgartiring yoki tozalang.')}</Empty>
          : <Empty title={t('Hozircha ochiq smena yo‘q')}>{t('Yangi smenalar har kuni qo‘shiladi. Kechroq qaytib ko‘ring.')}</Empty>)}
    </>
  );
}
