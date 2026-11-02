'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { home, useApp } from '@/components/app/AppShell';
import Avatar from '@/components/app/Avatar';
import { Field, TrustLine, useSubmit } from '@/components/app/parts';
import { useT } from '@/components/Lang';
import { api, type Me } from '@/lib/client';
import { MIN_AGE, ORG_TYPES, PLAN_CONTACT, PLANS, REGIONS, SKILLS, TELEGRAM_BOT, planName } from '@/lib/options';

type T = ReturnType<typeof useT>['t'];

// Rasmni markazidan kvadrat qilib qirqadi va 320×320 JPEG ga kichraytiradi (bazada ~20–40 KB)
async function toJpeg(file: File, t: T) {
  if (!file.type.startsWith('image/')) throw new Error(t('Rasm faylini tanlang'));
  const img = await createImageBitmap(file).catch(() => { throw new Error(t('Bu rasmni ochib bo‘lmadi. Boshqa rasm tanlang')); });
  const side = Math.min(img.width, img.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: 320, height: 320 });
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.85));
  if (!blob) throw new Error(t('Rasmni tayyorlab bo‘lmadi. Boshqa rasm tanlang'));
  let bin = '';
  for (const b of new Uint8Array(await blob.arrayBuffer())) bin += String.fromCharCode(b);
  return btoa(bin);
}

function PhotoPicker({ me }: { me: Me }) {
  const { setMe, toast } = useApp();
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setMe(await api<Me>('/me/photo', { data: await toJpeg(file, t) }));
      toast(t('Rasm saqlandi'));
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
        <p className="photo-label">{me.role === 'worker' ? t('Rasmingiz') : t('Logotip yoki rasm')}{me.role === 'worker' && !me.photo && <span className="req"> ({t('majburiy')})</span>}</p>
        <p className="hint">{me.role === 'worker' ? t('Yuzingiz aniq ko‘rinsin: biznes kimni qabul qilayotganini ko‘radi.') : t('Ishchilar smenangizni tanib olishi uchun.')}</p>
        <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" className="btn btn-line" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? t('Yuklanmoqda…') : me.photo ? t('Rasmni almashtirish') : t('Rasm yuklash')}
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
  const { t } = useT();
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
      toast(t('Profil tayyor. Endi smenalarga ariza bera olasiz'));
      router.push(home(user));
    } else {
      toast(user.complete ? t('Profil saqlandi') : t('Saqlandi. Rasm yuklasangiz, profil tayyor bo‘ladi'));
    }
  });

  return (
    <form className="form profile-form" onSubmit={onSubmit}>
      <h2>{worker ? t('Shaxsiy ma’lumotlar') : t('Biznes ma’lumotlari')}</h2>
      {!worker && (
        <div className="row-2">
          <Field label={t('Biznes nomi')}><input name="org" required maxLength={80} defaultValue={me.org ?? ''} /></Field>
          <Field label={t('Biznes turi')}>
            <select name="org_type" required defaultValue={me.org_type ?? ''}>
              <option value="" disabled>{t('Tanlang')}</option>
              {ORG_TYPES.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="row-2">
        <Field label={worker ? t('Ism') : t('Mas’ul shaxs ismi')}><input name="first_name" required minLength={2} maxLength={30} autoComplete="given-name" defaultValue={me.first_name ?? first} /></Field>
        <Field label={t('Familiya')}><input name="last_name" required minLength={2} maxLength={30} autoComplete="family-name" defaultValue={me.last_name ?? rest.join(' ')} /></Field>
      </div>
      {worker && (
        <>
          <div className="row-2">
            <Field label={age === null ? t('Tug‘ilgan sana') : t('Tug‘ilgan sana · {n} yosh', { n: age })}>
              <input type="date" name="birth_date" required value={birth} onChange={(e) => setBirth(e.target.value)} max={`${new Date().getFullYear() - MIN_AGE}-12-31`} />
            </Field>
            <fieldset className="roles gender">
              <legend>{t('Jinsi')}</legend>
              <label><input type="radio" name="gender" value="m" required defaultChecked={me.gender === 'm'} /><span>{t('Erkak')}</span></label>
              <label><input type="radio" name="gender" value="f" defaultChecked={me.gender === 'f'} /><span>{t('Ayol')}</span></label>
            </fieldset>
          </div>
          {age !== null && age < MIN_AGE && <p className="form-error">{t('Smenalarda {n} yoshdan katta bo‘lganlar ishlay oladi', { n: MIN_AGE })}</p>}
        </>
      )}
      <div className="row-2">
        <Field label={worker ? t('Qaysi viloyatda yashaysiz?') : t('Viloyat')}>
          <select name="region" required value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="" disabled>{t('Viloyatni tanlang')}</option>
            {Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        {/* Viloyat almashsa, tuman ro'yxati ham almashadi va tanlov boshidan boshlanadi */}
        <Field label={t('Tuman yoki shahar')}>
          <select key={region} name="district" required disabled={!region} defaultValue={region === me.region ? me.district ?? '' : ''}>
            <option value="" disabled>{region ? t('Tanlang') : t('Avval viloyatni tanlang')}</option>
            {(REGIONS[region] ?? []).map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
      </div>
      {!worker && <Field label={t('Manzil')}><input name="address" required minLength={5} maxLength={160} placeholder={t('Amir Temur ko‘chasi, 15-uy')} defaultValue={me.address ?? ''} /></Field>}
      {worker && (
        <fieldset className="checks">
          <legend>{t('Qaysi ishlarni qila olasiz?')} <span className="hint">({t('ixtiyoriy')})</span></legend>
          {SKILLS.map((s) => (
            <label key={s}><input type="checkbox" name="skills" value={s} defaultChecked={me.skills.includes(s)} /><span>{t(s)}</span></label>
          ))}
        </fieldset>
      )}
      <Field label={worker ? t('O‘zingiz haqingizda (ixtiyoriy)') : t('Biznes haqida (ixtiyoriy)')}>
        <textarea name="about" rows={3} maxLength={500} defaultValue={me.about}
          placeholder={worker ? t('Tajribangiz, qachon bo‘shsiz, qaysi tillarni bilasiz') : t('Nima bilan shug‘ullanasiz, ishchilarga qanday sharoit bor')} />
      </Field>
      <button className="btn btn-lg" type="submit" disabled={busy}>{me.complete ? t('Saqlash') : t('Profilni saqlash')}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

const Usage = ({ label, used, max }: { label: string; used: number; max: number }) => (
  <div className="usage">
    <p><span>{label}</span><b>{Math.min(used, max)} / {max}</b></p>
    <div className="usage-bar" aria-hidden="true"><div style={{ width: `${Math.min(100, (used / max) * 100)}%` }} /></div>
  </div>
);

// Obuna: tarif, Farbo'dan bugungi foydalanish va Pro taklifi. Pro'ni admin yoqadi (to'lov tizimi yo'q)
function SubscriptionCard({ me }: { me: Me }) {
  const { t } = useT();
  const limits = PLANS[me.plan];
  return (
    <section className={`sheet sub-card${me.plan === 'pro' ? ' is-pro' : ''}`} id="obuna">
      <h2>{t('Obuna')}</h2>
      <p className="sub-plan"><b>{t(planName(me.plan, me.role))}</b>{me.plan === 'pro' && <span>{me.plan_until ? t('{date} gacha', { date: me.plan_until }) : t('muddatsiz')}</span>}</p>
      <Usage label={t('Farbo savollari')} used={me.ai_used} max={limits.ai} />
      <Usage label={t('Ovozli javoblar')} used={me.tts_used} max={limits.tts} />
      <p className="hint">{t('Oxirgi 24 soat bo‘yicha hisoblanadi.')}</p>
      {me.plan === 'free' && (
        <div className="sub-offer">
          <p><b>{t(planName('pro', me.role))}</b>: {t('kuniga {ai} ta savol va {tts} ta ovozli javob (bepulda {fai} va {ftts}).', { ai: PLANS.pro.ai, tts: PLANS.pro.tts, fai: PLANS.free.ai, ftts: PLANS.free.tts })}</p>
          <a className="btn" href={PLAN_CONTACT.href} target="_blank" rel="noreferrer">{t('Pro olish')} · {PLAN_CONTACT.label}</a>
        </div>
      )}
    </section>
  );
}

// Telegram: kodlar, qabul, eslatmalar va takliflar shu botga keladi (raqam botga bog'langan bo'lishi kerak)
function TelegramCard() {
  const { t } = useT();
  return (
    <section className="sheet">
      <h2>{t('Telegram xabarlari')}</h2>
      <p>{t('Ariza, qabul, smenadan oldingi eslatma va takliflar Telegram’dagi botga keladi. Eslatmadagi “Kelaman” tugmasi ish beruvchiga darhol xabar beradi.')}</p>
      <a className="btn btn-line" href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noreferrer">@{TELEGRAM_BOT}</a>
      <p className="hint">{t('Xabarlar sayt tilida keladi: tilni yuqoridagi UZ / RU / EN tugmalari bilan almashtiring.')}</p>
    </section>
  );
}

function AccountCard({ me }: { me: Me }) {
  const { setMe, toast } = useApp();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { onSubmit, error, busy } = useSubmit(async (body) => {
    setMe(await api<Me>('/me/password', body));
    setOpen(false);
    toast(t('Parol almashtirildi. Boshqa qurilmalardagi kirishlar yopildi'));
  });

  return (
    <section className="sheet account">
      <h2>{t('Hisob')}</h2>
      <dl className="facts">
        <div><dt>{t('Telefon')}</dt><dd>{me.phone}</dd></div>
        <div><dt>{t('Hisob turi')}</dt><dd>{me.role === 'worker' ? t('Ishchi') : t('Biznes')}</dd></div>
        <div><dt>{t('Kirish usuli')}</dt><dd>{me.google ? 'Google' : t('Telefon va parol')}</dd></div>
        {me.rating ? <div><dt>{t('Reyting')}</dt><dd><span className="stars">★ {me.rating}</span></dd></div> : null}
        {me.role === 'worker' && <div><dt>{t('Bajarilgan smenalar')}</dt><dd>{me.done ?? 0}</dd></div>}
        {me.role === 'worker' && me.reliability != null && <div><dt>{t('Kelish foizi')}</dt><dd>{me.reliability}%</dd></div>}
        {me.role === 'business' && <div><dt>{t('Bajarilgan ishlar')}</dt><dd>{me.hired ?? 0}</dd></div>}
      </dl>
      {me.role === 'worker' && (
        <TrustLine trust={{ rating: me.rating, done: me.done ?? 0, noshows: me.noshows ?? 0, checkins: me.checkins ?? 0, reliability: me.reliability ?? null, badge: me.badge ?? null }} />
      )}
      {!me.google && (open ? (
        <form className="pw-form" onSubmit={onSubmit}>
          <Field label={t('Joriy parol')}><input type="password" name="old_password" required autoComplete="current-password" /></Field>
          <Field label={t('Yangi parol')}><input type="password" name="new_password" required minLength={6} autoComplete="new-password" /></Field>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>{t('Almashtirish')}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>{t('Bekor qilish')}</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      ) : <button type="button" className="btn btn-line" onClick={() => setOpen(true)}>{t('Parolni almashtirish')}</button>)}
    </section>
  );
}

export default function Profile() {
  const { me, ready } = useApp();
  const { t } = useT();
  const router = useRouter();
  useEffect(() => { if (ready && !me) router.replace('/ilova/kirish'); }, [ready, me, router]);
  if (!me) return null;

  return (
    <>
      <h1>{me.complete ? t('Profilim') : t('Profilni to‘ldiring')}</h1>
      {!me.complete && (
        <p className="banner">
          {me.role === 'worker'
            ? t('Smenalarga ariza berishdan oldin profilni to‘ldiring. Ism, yosh, tuman va rasmingizni biznes arizangiz bilan birga ko‘radi.')
            : t('Smena e’lon qilishdan oldin biznesingiz haqida ma’lumot bering. Ishchilar kimning smenasiga borayotganini bilishi kerak.')}
        </p>
      )}
      <div className="profile-grid">
        <div className="profile-main">
          <section className="sheet"><PhotoPicker me={me} /></section>
          <ProfileForm me={me} />
        </div>
        <div className="profile-side">
          <AccountCard me={me} />
          <TelegramCard />
          <SubscriptionCard me={me} />
        </div>
      </div>
    </>
  );
}
