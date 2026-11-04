'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp, useGuard } from '@/components/app/AppShell';
import { Field, useSubmit } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, locate, tashkentDate, type Point, type Shift } from '@/lib/client';

const PickMap = dynamic(() => import('@/components/app/Map').then((m) => m.PickMap), { ssr: false, loading: () => <div className="map map-pick map-loading" /> });
const REPEATS = [['none', 'Bir martalik'], ['daily', 'Har kuni'], ['weekly', 'Har hafta']];

export default function NewShift() {
  const me = useGuard('business');
  const { toast } = useApp();
  const { t } = useT();
  const router = useRouter();
  const [repeat, setRepeat] = useState('none');
  const today = tashkentDate();
  const [date, setDate] = useState(today);
  // Smena joyi xaritada: avvalgi smenaning joyidan boshlanadi
  const [place, setPlace] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => { if (me?.lat != null && me.lng != null) setPlace((p) => p ?? { lat: me.lat!, lng: me.lng! }); }, [me?.lat, me?.lng]);
  // Shoshilinch: faqat bugun yoki ertaga va bir martalik
  const canUrgent = repeat === 'none' && date <= tashkentDate(1);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const { ids, alerted } = await api<{ id: number; ids: number[]; alerted: number }>('/shifts', body);
    toast(alerted ? t('Smena e’lon qilindi. Yaqindagi {n} ta ishonchli ishchiga xabar yuborildi', { n: alerted })
      : ids.length > 1 ? t('{n} ta smena e’lon qilindi', { n: ids.length }) : t('Smena e’lon qilindi'));
    router.push('/ilova/biznes');
  });
  const form = useRef<HTMLFormElement>(null);

  async function myLocation() {
    setLocating(true);
    try {
      setPlace(await locate({ denied: t('Joylashuvga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering'), failed: t('Joylashuvni aniqlab bo‘lmadi. Qayta urinib ko‘ring') }));
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setLocating(false);
    }
  }

  // Bizneslar sahifasidagi "Kim kerak?" dan kelganda: ?lavozim=...&soni=... formaga yoziladi.
  // Farbo tayyorlagan loyihadan: ?lavozim, soni, sana, boshlanish, tugash, haq, manzil, izoh, shoshilinch.
  // "Nusxa olish" dan kelganda (?nusxa=id): o'sha smenaning maydonlari va joyi, sanasi — bugun
  useEffect(() => {
    if (!me) return;
    const q = new URLSearchParams(location.search);
    const set = (name: string, value: string | number | null | undefined) => {
      const input = form.current?.elements.namedItem(name) as HTMLInputElement | null;
      if (input && value != null && value !== '') input.value = String(value);
    };
    set('title', q.get('lavozim')?.slice(0, 80));
    set('slots', q.get('soni'));
    set('start', q.get('boshlanish'));
    set('end', q.get('tugash'));
    set('pay', q.get('haq'));
    set('place', q.get('manzil')?.slice(0, 120));
    set('note', q.get('izoh')?.slice(0, 500));
    const day = q.get('sana');
    if (day && day >= tashkentDate()) { set('date', day); setDate(day); }
    if (q.get('shoshilinch') === '1') { const box = form.current?.elements.namedItem('urgent') as HTMLInputElement | null; if (box) box.checked = true; }
    const copy = Number(q.get('nusxa'));
    if (copy) {
      api<{ shift: Shift }>(`/shifts/${copy}`).then(({ shift: s }) => {
        set('title', s.title); set('place', s.place); set('start', s.start_time); set('end', s.end_time);
        set('pay', s.pay); set('slots', s.slots); set('note', s.note);
        if (s.lat != null && s.lng != null) setPlace({ lat: s.lat, lng: s.lng });
      }).catch(() => {});
    }
  }, [me]);

  if (!me) return null;

  return (
    <>
      <h1>{t('Yangi smena')}</h1>
      <form className="form" onSubmit={onSubmit} ref={form}>
        <Field label={t('Lavozim')}><input name="title" required maxLength={80} placeholder={t('Ofitsiant')} /></Field>
        <Field label={t('Manzil')}><input name="place" required maxLength={120} placeholder={t('Yunusobod, 4-mavze, Bahor to‘yxonasi')} /></Field>
        <div className="row">
          <Field label={t('Sana')}><input type="date" name="date" required min={today} defaultValue={today} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('Boshlanishi')}><input type="time" name="start" required defaultValue="18:00" /></Field>
          <Field label={t('Tugashi')}><input type="time" name="end" required defaultValue="23:00" /></Field>
        </div>
        <div className="row">
          <Field label={t('Haq, so‘m')}><input type="number" name="pay" required min={10000} max={5000000} step={1000} inputMode="numeric" placeholder="250000" /></Field>
          <Field label={t('Necha kishi kerak')}><input type="number" name="slots" required min={1} max={50} defaultValue={1} inputMode="numeric" /></Field>
        </div>
        <div className="row">
          <Field label={t('Takrorlash')}>
            <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              {REPEATS.map(([v, label]) => <option key={v} value={v}>{t(label)}</option>)}
            </select>
          </Field>
          {repeat !== 'none' && (
            <Field label={t('Jami nechta smena')}><input type="number" name="times" required min={2} max={12} defaultValue={repeat === 'daily' ? 5 : 4} inputMode="numeric" /></Field>
          )}
        </div>
        {repeat !== 'none' && <p className="hint">{t('Bir xil vaqt va haq bilan alohida smenalar ochiladi: har biriga arizalarni alohida ko‘rasiz.')}</p>}
        <Field label={t('Izoh (ixtiyoriy)')}><textarea name="note" maxLength={500} rows={3} placeholder={t('Kiyim: oq ko‘ylak, qora shim. Ovqat beriladi.')} /></Field>
        <fieldset className="place-pick">
          <legend>{t('Smena joyi xaritada')} <span className="hint">({t('tavsiya etiladi')})</span></legend>
          <p className="hint">{t('Xaritani bosing yoki belgini suring. Ishchilar smenani xaritada va “Yaqinimdagilar” da ko‘radi, yo‘l ko‘rsatiladi, “Keldim” esa faqat shu joydan 300 m ichida ishlaydi.')}</p>
          <PickMap value={place} onChange={setPlace} />
          <div className="actions">
            <button type="button" className="btn btn-line" disabled={locating} onClick={myLocation}>📍 {locating ? t('Aniqlanmoqda…') : t('Hozir shu yerdaman')}</button>
            {place && <button type="button" className="btn btn-ghost" onClick={() => setPlace(null)}>{t('Joyni olib tashlash')}</button>}
          </div>
          <input type="hidden" name="lat" value={place?.lat ?? ''} />
          <input type="hidden" name="lng" value={place?.lng ?? ''} />
        </fieldset>
        <label className="check check-urgent">
          <input type="checkbox" name="urgent" value="1" disabled={!canUrgent} /> 🔥 {t('Shoshilinch: ro‘yxat tepasida turadi, yaqindagi ishonchli ishchilarga Telegram’da darhol xabar boradi')}
        </label>
        {!canUrgent && <p className="hint">{t('Shoshilinch smena faqat bugun yoki ertaga uchun va takrorsiz bo‘ladi.')}</p>}
        <label className="check"><input type="checkbox" name="notify" value="1" defaultChecked /> {t('Sevimli ishchilarimga Telegram’da xabar yuborish')}</label>
        <button className="btn btn-lg" type="submit" disabled={busy}>{t('Smenani e’lon qilish')}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </>
  );
}
