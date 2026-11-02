'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp, useGuard } from '@/components/app/AppShell';
import { Field, useSubmit } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, tashkentDate, type Shift } from '@/lib/client';

const REPEATS = [['none', 'Bir martalik'], ['daily', 'Har kuni'], ['weekly', 'Har hafta']];

export default function NewShift() {
  const me = useGuard('business');
  const { toast } = useApp();
  const { t } = useT();
  const router = useRouter();
  const [repeat, setRepeat] = useState('none');
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    const { ids } = await api<{ id: number; ids: number[] }>('/shifts', body);
    toast(ids.length > 1 ? t('{n} ta smena e’lon qilindi', { n: ids.length }) : t('Smena e’lon qilindi'));
    router.push('/ilova/biznes');
  });
  const form = useRef<HTMLFormElement>(null);

  // Bizneslar sahifasidagi "Kim kerak?" dan kelganda: ?lavozim=...&soni=... formaga yoziladi.
  // "Nusxa olish" dan kelganda (?nusxa=id): o'sha smenaning maydonlari, sanasi — bugun
  useEffect(() => {
    if (!me) return;
    const q = new URLSearchParams(location.search);
    const set = (name: string, value: string | number | null | undefined) => {
      const input = form.current?.elements.namedItem(name) as HTMLInputElement | null;
      if (input && value != null && value !== '') input.value = String(value);
    };
    set('title', q.get('lavozim')?.slice(0, 80));
    set('slots', q.get('soni'));
    const copy = Number(q.get('nusxa'));
    if (copy) {
      api<{ shift: Shift }>(`/shifts/${copy}`).then(({ shift: s }) => {
        set('title', s.title); set('place', s.place); set('start', s.start_time); set('end', s.end_time);
        set('pay', s.pay); set('slots', s.slots); set('note', s.note);
      }).catch(() => {});
    }
  }, [me]);

  if (!me) return null;
  const today = tashkentDate();

  return (
    <>
      <h1>{t('Yangi smena')}</h1>
      <form className="form" onSubmit={onSubmit} ref={form}>
        <Field label={t('Lavozim')}><input name="title" required maxLength={80} placeholder={t('Ofitsiant')} /></Field>
        <Field label={t('Manzil')}><input name="place" required maxLength={120} placeholder={t('Yunusobod, 4-mavze, Bahor to‘yxonasi')} /></Field>
        <div className="row">
          <Field label={t('Sana')}><input type="date" name="date" required min={today} defaultValue={today} /></Field>
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
        <label className="check"><input type="checkbox" name="notify" value="1" defaultChecked /> {t('Sevimli ishchilarimga Telegram’da xabar yuborish')}</label>
        <button className="btn btn-lg" type="submit" disabled={busy}>{t('Smenani e’lon qilish')}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </>
  );
}
