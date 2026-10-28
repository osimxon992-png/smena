'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useApp, useGuard } from '@/components/app/AppShell';
import { Field, useSubmit } from '@/components/app/parts';
import { api, tashkentDate } from '@/lib/client';

export default function NewShift() {
  const me = useGuard('business');
  const { toast } = useApp();
  const router = useRouter();
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    await api('/shifts', body);
    toast('Smena e’lon qilindi');
    router.push('/ilova/biznes');
  });
  const form = useRef<HTMLFormElement>(null);

  // Bizneslar sahifasidagi "Kim kerak?" dan kelganda: ?lavozim=...&soni=... formaga yoziladi
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const set = (name: string, value: string | null) => {
      const input = form.current?.elements.namedItem(name) as HTMLInputElement | null;
      if (input && value) input.value = value;
    };
    set('title', q.get('lavozim')?.slice(0, 80) ?? null);
    set('slots', q.get('soni'));
  }, [me]);

  if (!me) return null;
  const today = tashkentDate();

  return (
    <>
      <h1>Yangi smena</h1>
      <form className="form" onSubmit={onSubmit} ref={form}>
        <Field label="Lavozim"><input name="title" required maxLength={80} placeholder="Ofitsiant" /></Field>
        <Field label="Manzil"><input name="place" required maxLength={120} placeholder="Yunusobod, 4-mavze, Bahor to‘yxonasi" /></Field>
        <div className="row">
          <Field label="Sana"><input type="date" name="date" required min={today} defaultValue={today} /></Field>
          <Field label="Boshlanishi"><input type="time" name="start" required defaultValue="18:00" /></Field>
          <Field label="Tugashi"><input type="time" name="end" required defaultValue="23:00" /></Field>
        </div>
        <div className="row">
          <Field label="Haq, so‘m"><input type="number" name="pay" required min={10000} max={5000000} step={1000} inputMode="numeric" placeholder="250000" /></Field>
          <Field label="Necha kishi kerak"><input type="number" name="slots" required min={1} max={50} defaultValue={1} inputMode="numeric" /></Field>
        </div>
        <Field label="Izoh (ixtiyoriy)"><textarea name="note" maxLength={500} rows={3} placeholder="Kiyim: oq ko‘ylak, qora shim. Ovqat beriladi." /></Field>
        <button className="btn btn-lg" type="submit" disabled={busy}>Smenani e’lon qilish</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </>
  );
}
