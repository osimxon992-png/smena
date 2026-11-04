// Tillar: o'zbek (asosiy), rus va ingliz. Tanlov "lang" cookie'sida; kirgan foydalanuvchida bazada ham (Telegram xabarlari shu tilda).
// Lug'at kaliti — o'zbekcha matnning o'zi: tarjima topilmasa, o'zbekchasi chiqadi va sahifa buzilmaydi.
// Matndagi {nom} o'rniga vars dagi qiymat qo'yiladi.

export const LANGS = ['uz', 'ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' };
export const LANG_SHORT: Record<Lang, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };

// [rus, ingliz]
export type Dict = Record<string, readonly [string, string]>;
export type Vars = Record<string, string | number | null | undefined>;

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
export const langFromCookie = (cookieHeader: string | null | undefined): Lang => {
  const v = /(?:^|;\s*)lang=(\w+)/.exec(cookieHeader ?? '')?.[1];
  return isLang(v) ? v : 'uz';
};

export const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] == null ? m : String(vars[k]))) : text;

export function translate(dict: Dict, lang: Lang, key: string, vars?: Vars) {
  const row = lang === 'uz' ? undefined : dict[key];
  return fill(row ? row[lang === 'ru' ? 0 : 1] : key, vars);
}

// Sana va pul: har tilda o'z ko'rinishi (Toshkent vaqti bo'yicha "Bugun"/"Ertaga")
const MONTHS: Record<Lang, string[]> = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export const WEEKDAYS: Record<Lang, string[]> = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const TODAY: Record<Lang, [string, string]> = { uz: ['Bugun', 'Ertaga'], ru: ['Сегодня', 'Завтра'], en: ['Today', 'Tomorrow'] };
const CURRENCY: Record<Lang, string> = { uz: 'so‘m', ru: 'сум', en: 'UZS' };

export const tashkentDate = (plusDays = 0) => new Date(Date.now() + plusDays * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
export const money = (lang: Lang, n: number) => `${Number(n).toLocaleString('ru-RU')} ${CURRENCY[lang]}`;
export const currency = (lang: Lang) => CURRENCY[lang];

// Oy nomi hisobotlar uchun: "oktabr 2026", "октябрь 2026", "October 2026" (ym — YYYY-MM)
const MONTHS_NOMINATIVE: Record<Lang, string[]> = {
  uz: MONTHS.uz,
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  en: MONTHS.en,
};
export const monthName = (lang: Lang, ym: string) => `${MONTHS_NOMINATIVE[lang][Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function dayName(lang: Lang, iso: string, withWeekday = true) {
  if (iso === tashkentDate()) return TODAY[lang][0];
  if (iso === tashkentDate(1)) return TODAY[lang][1];
  const d = new Date(`${iso}T00:00:00Z`);
  const date = lang === 'uz' ? `${d.getUTCDate()}-${MONTHS.uz[d.getUTCMonth()]}`
    : lang === 'ru' ? `${d.getUTCDate()} ${MONTHS.ru[d.getUTCMonth()]}`
    : `${MONTHS.en[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withWeekday ? `${date}, ${WEEKDAYS[lang][d.getUTCDay()]}` : date;
}
