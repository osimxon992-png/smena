// Server komponentlari uchun til: "lang" cookie'sidan
import { cookies } from 'next/headers';
import { isLang, translate, type Lang, type Vars } from './i18n';
import { UI } from './ui';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get('lang')?.value;
  return isLang(v) ? v : 'uz';
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: (key: string, vars?: Vars) => translate(UI, lang, key, vars) };
}
