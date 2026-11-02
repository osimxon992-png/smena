import type { Metadata } from 'next';
import NextSign from '@/components/site/NextSign';
import PageHead from '@/components/site/PageHead';
import RuleCheck from '@/components/site/RuleCheck';
import { getT } from '@/lib/lang-server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t('Qoidalar'),
    description: t('Smena qoidalari: kelmagan ishchi bloklanadi, bir kun oldin bekor qilish bepul, raqam qabuldan keyin ochiladi.'),
  };
}

const RULES = [
  ['Haq oldindan yoziladi.', 'Har bir e’londa vaqt, manzil va pul aniq turadi.'],
  ['Bir kun oldin bekor qilish bepul.', 'Smena kuni qabul qilingan arizani bekor qilib bo‘lmaydi.'],
  ['Eslatma va tasdiq.', 'Smenadan bir kun va 3 soat oldin Telegram’da eslatma keladi: “Kelaman” yoki “Kela olmayman” deb javob berasiz.'],
  ['Keldim tugmasi.', 'Joyiga yetib kelgach ilovada “Keldim” ni bosasiz: ish beruvchi darhol ko‘radi, bu kelish foizingizga yoziladi.'],
  ['Raqam qabuldan keyin ochiladi.', 'Telefoningizni faqat sizni qabul qilgan ish beruvchi ko‘radi.'],
  ['Baho ikki tomonlama.', 'Ishchi ham, biznes ham baholanadi.'],
];

export default async function Rules() {
  const { t } = await getT();
  return (
    <>
      <PageHead title={t('Qoidalar')} lead={t('Qoidalar oz va hammaga bir xil. Ular biznesga odam kelishini, ishchiga esa aytilgan haqni kafolatlash uchun.')}>
        <RuleCheck />
      </PageHead>

      <section className="section rules" aria-labelledby="rules-title">
        <div className="wrap rules-grid">
          <div className="sign sign-teal sign-big taped">
            <h2 id="rules-title" className="h2">{t('Kelmagan bloklanadi.')}</h2>
            <p>{t('Asosiy qoida shu. Qabul qilingan smenaga kelmagan ishchi platformadan chiqariladi. Biznes e’lon qo‘yganda odam keladi, siz esa reytingingiz bilan ishonch qozonasiz.')}</p>
          </div>
          <div className="sheet rules-sheet">
            <h3>{t('Bozor qoidalari')}</h3>
            <ul className="rules-list">
              {RULES.map(([title, text]) => <li key={title}><strong>{t(title)}</strong> {t(text)}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <NextSign href="/bizneslar" title={t('Bizneslar uchun')} tone="ink" />
    </>
  );
}
