'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { Field, useSubmit } from '@/components/app/parts';
import { api, type Me } from '@/lib/client';
import { MIN_AGE, ORG_TYPES, REGIONS, SKILLS } from '@/lib/options';

// Rasmni markazidan kvadrat qilib qirqadi va 320×320 JPEG ga kichraytiradi (bazada ~20–40 KB)
async function toJpeg(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Rasm faylini tanlang');
  const img = await createImageBitmap(file).catch(() => { throw new Error('Bu rasmni ochib bo‘lmadi. Boshqa rasm tanlang'); });
  const side = Math.min(img.width, img.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 320 });
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Rasmni tayyorlab bo‘lmadi. Boshqa rasm tanlang');
  let bin = '';
  for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
  return btoa(bin);
}

function PhotoPicker({ me }: { me: Me }) {
  const { setMe, toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setMe(await api<Me>('/me/photo', { data: await toJpeg(file) }));
      toast('Rasm saqlandi');
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-pick">
      <Avatar photo={me.photo} name={me.name} className="avatar-lg" />
      <div>
        <p className="photo-label">{me.role === 'worker' ? 'Rasmingiz' : 'Logotip yoki rasm'}{me.role === 'worker' && !me.photo && <span className="req"> (majburiy)</span>}</p>
        <p className="hint">{me.role === 'worker' ? 'Yuzingiz aniq ko‘rinsin: biznes kimni qabul qilayotganini ko‘radi.' : 'Ishchilar smenangizni tanib olishi uchun.'}</p>
        <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" className="btn btn-line" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Yuklanmoqda…' : me.photo ? 'Rasmni almashtirish' : 'Rasm yuklash'}
        </button>
      </div>
    </div>
  );
}

function ageOf(birth: string) {
  if (!birth) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) >= birth.slice(5) ? years : years - 1;
}

function ProfileForm({ me }: { me: Me }) {
  const { setMe, toast } = useApp();
  const router = useRouter();
  const [birth, setBirth] = useState(me.birth_date ?? '');
  const [region, setRegion] = useState(me.region ?? '');
  const age = ageOf(birth);
  // Ro'yxatdagi "Ismingiz" dan boshlang'ich ism va familiya
  const [first, ...rest] = me.name.split(/\s+/);
  const worker = me.role === 'worker';

  const { onSubmit, error, busy } = useSubmit(async (body, form) => {
    const user = await api<Me>('/me/profile', { ...body, skills: form.getAll('skills') });
    setMe(user);
    if (user.complete && !me.complete) {
      toast('Profil tayyor. Endi smenalarga ariza bera olasiz');
      router.push(home(user));
    } else {
      toast(user.complete ? 'Profil saqlandi' : 'Saqlandi. Rasm yuklasangiz, profil tayyor bo‘ladi');
    }
  });

  return (
    <form className="form profile-form" onSubmit={onSubmit}>
      <h2>{worker ? 'Shaxsiy ma’lumotlar' : 'Biznes ma’lumotlari'}</h2>
      {!worker && (
        <div className="row-2">
          <Field label="Biznes nomi"><input name="org" required maxLength={80} defaultValue={me.org ?? ''} /></Field>
          <Field label="Biznes turi">
            <select name="org_type" required defaultValue={me.org_type ?? ''}>
              <option value="" disabled>Tanlang</option>
              {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="row-2">
        <Field label={worker ? 'Ism' : 'Mas’ul shaxs ismi'}><input name="first_name" required minLength={2} maxLength={30} autoComplete="given-name" defaultValue={me.first_name ?? first} /></Field>
        <Field label="Familiya"><input name="last_name" required minLength={2} maxLength={30} autoComplete="family-name" defaultValue={me.last_name ?? rest.join(' ')} /></Field>
      </div>
      {worker && (
        <>
          <div className="row-2">
            <Field label={age === null ? 'Tug‘ilgan sana' : `Tug‘ilgan sana · ${age} yosh`}>
              <input type="date" name="birth_date" required value={birth} onChange={(e) => setBirth(e.target.value)} max={`${new Date().getFullYear() - MIN_AGE}-12-31`} />
            </Field>
            <fieldset className="roles gender">
              <legend>Jinsi</legend>
              <label><input type="radio" name="gender" value="m" required defaultChecked={me.gender === 'm'} /><span>Erkak</span></label>
              <label><input type="radio" name="gender" value="f" defaultChecked={me.gender === 'f'} /><span>Ayol</span></label>
            </fieldset>
          </div>
          {age !== null && age < MIN_AGE && <p className="form-error">Smenalarda {MIN_AGE} yoshdan katta bo‘lganlar ishlay oladi</p>}
        </>
      )}
      <div className="row-2">
        <Field label={worker ? 'Qaysi viloyatda yashaysiz?' : 'Viloyat'}>
          <select name="region" required value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="" disabled>Viloyatni tanlang</option>
            {Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {/* Viloyat almashsa, tuman ro'yxati ham almashadi va tanlov boshidan boshlanadi */}
        <Field label="Tuman yoki shahar">
          <select key={region} name="district" required disabled={!region} defaultValue={region === me.region ? me.district ?? '' : ''}>
            <option value="" disabled>{region ? 'Tanlang' : 'Avval viloyatni tanlang'}</option>
            {(REGIONS[region] ?? []).map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      {!worker && <Field label="Manzil"><input name="address" required minLength={5} maxLength={160} placeholder="Amir Temur ko‘chasi, 15-uy" defaultValue={me.address ?? ''} /></Field>}
      {worker && (
        <fieldset className="checks">
          <legend>Qaysi ishlarni qila olasiz? <span className="hint">(ixtiyoriy)</span></legend>
          {SKILLS.map((s) => (
            <label key={s}><input type="checkbox" name="skills" value={s} defaultChecked={me.skills.includes(s)} /><span>{s}</span></label>
          ))}
        </fieldset>
      )}
      <Field label={worker ? 'O‘zingiz haqingizda (ixtiyoriy)' : 'Biznes haqida (ixtiyoriy)'}>
        <textarea name="about" rows={3} maxLength={500} defaultValue={me.about}
          placeholder={worker ? 'Tajribangiz, qachon bo‘shsiz, qaysi tillarni bilasiz' : 'Nima bilan shug‘ullanasiz, ishchilarga qanday sharoit bor'} />
      </Field>
      <button className="btn btn-lg" type="submit" disabled={busy}>{me.complete ? 'Saqlash' : 'Profilni saqlash'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

function AccountCard({ me }: { me: Me }) {
  const { setMe, toast } = useApp();
  const [open, setOpen] = useState(false);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    setMe(await api<Me>('/me/password', body));
    setOpen(false);
    toast('Parol almashtirildi. Boshqa qurilmalardagi kirishlar yopildi');
  });

  return (
    <section className="sheet account">
      <h2>Hisob</h2>
      <dl className="facts">
        <div><dt>Telefon</dt><dd>{me.phone}</dd></div>
        <div><dt>Hisob turi</dt><dd>{me.role === 'worker' ? 'Ishchi' : 'Biznes'}</dd></div>
        <div><dt>Kirish usuli</dt><dd>{me.google ? 'Google' : 'Telefon va parol'}</dd></div>
        {me.rating ? <div><dt>Reyting</dt><dd><span className="stars">★ {me.rating}</span></dd></div> : null}
        {me.role === 'worker' && <div><dt>Bajarilgan smenalar</dt><dd>{me.done ?? 0}</dd></div>}
      </dl>
      {!me.google && (open ? (
        <form className="pw-form" onSubmit={onSubmit}>
          <Field label="Joriy parol"><input type="password" name="old_password" required autoComplete="current-password" /></Field>
          <Field label="Yangi parol"><input type="password" name="new_password" required minLength={6} autoComplete="new-password" /></Field>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>Almashtirish</button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>Bekor qilish</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      ) : <button type="button" className="btn btn-line" onClick={() => setOpen(true)}>Parolni almashtirish</button>)}
    </section>
  );
}

export default function Profile() {
  const { me, ready } = useApp();
  const router = useRouter();
  useEffect(() => { if (ready && !me) router.replace('/ilova/kirish'); }, [ready, me, router]);
  if (!me) return null;

  return (
    <>
      <h1>{me.complete ? 'Profilim' : 'Profilni to‘ldiring'}</h1>
      {!me.complete && (
        <p className="banner">
          {me.role === 'worker'
            ? 'Smenalarga ariza berishdan oldin profilni to‘ldiring. Ism, yosh, tuman va rasmingizni biznes arizangiz bilan birga ko‘radi.'
            : 'Smena e’lon qilishdan oldin biznesingiz haqida ma’lumot bering. Ishchilar kimning smenasiga borayotganini bilishi kerak.'}
        </p>
      )}
      <div className="profile-grid">
        <div className="profile-main">
          <section className="sheet"><PhotoPicker me={me} /></section>
          <ProfileForm me={me} />
        </div>
        <AccountCard me={me} />
      </div>
    </>
  );
}
