// Brauzer tomonidagi umumiy yordamchilar: API chaqiruvi, sana va pul formati.
import { langFromCookie, translate } from './i18n';
import { UI } from './ui';

export type Shift = {
  id: number; title: string; place: string; date: string; start_time: string; end_time: string;
  pay: number; slots?: number; taken?: number; note?: string; org?: string; org_rating?: number | null;
  my_status?: Status | null; pending?: number; demo?: number;
  // Ishonch va sevimlilar: biznesda nechta smena bajarilgan, u meni sevimli qilganmi, shu smenaga taklif qilganmi
  org_done?: number; org_district?: string | null; fav?: number; invited?: number;
  // Biznesning o'z ro'yxatida: kelishini tasdiqlaganlar va "Keldim" bosganlar
  confirmed?: number; checked_in?: number;
  // Xaritadagi joy, shoshilinch belgisi, "Yaqinimdagilar" da masofa (metr), biznes haqni o'z vaqtida to'lash foizi
  business_id?: number; lat?: number | null; lng?: number | null; urgent?: number; distance?: number | null; org_paid?: number | null;
};
export type Point = { lat: number; lng: number };
// Ishchining ishonch ko'rsatkichlari: kelish foizi (qabul qilingan smenalarning nechtasiga kelgan) va belgi
export type Trust = {
  rating: number | null; done: number; noshows: number; checkins: number; reliability: number | null; badge: 'new' | 'reliable' | 'top' | null;
};
export type Status = 'pending' | 'accepted' | 'rejected' | 'came' | 'noshow';
export type Me = {
  id: number; role: 'worker' | 'business'; name: string; org: string | null; phone: string; blocked: boolean; rating: number | null; done?: number;
  first_name: string | null; last_name: string | null; birth_date: string | null; age: number | null; gender: 'm' | 'f' | null;
  region: string | null; district: string | null; about: string; skills: string[]; org_type: string | null; address: string | null;
  photo: string | null; google: boolean; complete: boolean;
  // Obuna: amaldagi tarif, Pro tugash sanasi (null = muddatsiz), oxirgi 24 soatdagi Farbo foydalanishi
  plan: 'free' | 'pro'; plan_until: string | null; ai_used: number; tts_used: number;
  lang: 'uz' | 'ru' | 'en';
  // Ishchida: ishonch ko'rsatkichlari; biznesda: smenalarida necha marta ish bajarilgan
  noshows?: number; checkins?: number; reliability?: number | null; badge?: Trust['badge']; hired?: number;
  // Saqlangan joylashuv, taklif havolasi kodi va taklif qilinganlar, biznesda haqni o'z vaqtida to'lash foizi
  lat: number | null; lng: number | null; ref_code: string; referrals: { invited: number; rewarded: number }; paid_pct?: number | null;
};
export type Review = { rating: number; text: string | null; date: string; org?: string; author?: string; title?: string };

export const STATUS: Record<Status, string> = { pending: 'Kutilmoqda', accepted: 'Qabul qilindi', rejected: 'Rad etildi', came: 'Bajarildi', noshow: 'Kelmadi' };
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

// Smena ulushi: bajarilgan smena haqining 15% ini ishchi to'laydi; biznes uchun e'lon va tanlov bepul
export const SHARE = 0.15;
export const som = (n: number) => `${Number(n).toLocaleString('ru-RU')} so‘m`;
export const tashkentDate = (plusDays = 0) => new Date(Date.now() + plusDays * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

export function day(iso: string, withWeekday = true) {
  if (iso === tashkentDate()) return 'Bugun';
  if (iso === tashkentDate(1)) return 'Ertaga';
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}${withWeekday ? `, ${DAYS[d.getUTCDay()]}` : ''}`;
}

export async function api<T = any>(path: string, body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch {
    throw new Error(translate(UI, langFromCookie(document.cookie), 'Internet aloqasi yo‘q. Ulanib, qayta urinib ko‘ring'));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || translate(UI, langFromCookie(document.cookie), 'Xatolik yuz berdi'));
  return data;
}

// Telefon joylashuvi (GPS). Ruxsat berilmasa yoki aniqlanmasa — tushunarli xato
export function locate(messages: { denied: string; failed: string }) {
  return new Promise<Point>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error(messages.failed));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? messages.denied : messages.failed)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

// Yo'l ko'rsatish: Google Maps (joyi belgilangan bo'lsa koordinata, aks holda manzil matni bilan qidiruv)
export const directionsUrl = (s: { lat?: number | null; lng?: number | null; place: string }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : encodeURIComponent(`${s.place}, Toshkent`)}`;

// Masofa: 450 m, 1,2 km
export const meters = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

// Taklif havolasidan kelgan kod: ro'yxat yoki Google orqali kirishgacha saqlanadi (sahifalar almashsa ham)
const REF_KEY = 'smena-ref';
export function rememberRef() {
  const ref = new URLSearchParams(location.search).get('ref');
  try { if (ref && /^[0-9a-z]{1,10}$/.test(ref)) localStorage.setItem(REF_KEY, ref); } catch { /* xotira yopiq */ }
}
export const savedRef = () => { try { return localStorage.getItem(REF_KEY) || undefined; } catch { return undefined; } };
