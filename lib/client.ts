// Brauzer tomonidagi umumiy yordamchilar: API chaqiruvi, sana va pul formati.
export type Shift = {
  id: number; title: string; place: string; date: string; start_time: string; end_time: string;
  pay: number; slots?: number; taken?: number; note?: string; org?: string; org_rating?: number | null;
  my_status?: Status | null; pending?: number;
};
export type Status = 'pending' | 'accepted' | 'rejected' | 'came' | 'noshow';
export type Me = {
  id: number; role: 'worker' | 'business'; name: string; org: string | null; phone: string; blocked: boolean; rating: number | null; done?: number;
  first_name: string | null; last_name: string | null; birth_date: string | null; age: number | null; gender: 'm' | 'f' | null;
  region: string | null; district: string | null; about: string; skills: string[]; org_type: string | null; address: string | null;
  photo: string | null; google: boolean; complete: boolean;
};

export const STATUS: Record<Status, string> = { pending: 'Kutilmoqda', accepted: 'Qabul qilindi', rejected: 'Rad etildi', came: 'Bajarildi', noshow: 'Kelmadi' };
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const DAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

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
    throw new Error('Internet aloqasi yo‘q. Ulanib, qayta urinib ko‘ring');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Xatolik yuz berdi');
  return data;
}
