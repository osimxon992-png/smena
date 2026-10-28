import type { Metadata } from 'next';
import NextSign from '@/components/site/NextSign';

export const metadata: Metadata = {
  title: 'Qoidalar',
  description: 'Smena qoidalari: kelmagan ishchi bloklanadi, bir kun oldin bekor qilish bepul, raqam qabuldan keyin ochiladi.',
};

const RULES = [
  ['Haq oldindan yoziladi.', 'Har bir e’londa vaqt, manzil va pul aniq turadi.'],
  ['Bir kun oldin bekor qilish bepul.', 'Smena kuni qabul qilingan arizani bekor qilib bo‘lmaydi.'],
  ['Raqam qabuldan keyin ochiladi.', 'Telefoningizni faqat sizni qabul qilgan ish beruvchi ko‘radi.'],
  ['Baho ikki tomonlama.', 'Ishchi ham, biznes ham baholanadi.'],
];

export default function Rules() {
  return (
    <>
      <header className="page-head wrap">
        <h1 className="page-title">Qoidalar</h1>
        <p className="lead">Qoidalar oz va hammaga bir xil. Ular biznesga odam kelishini, ishchiga esa aytilgan haqni kafolatlash uchun.</p>
      </header>

      <section className="section rules" aria-labelledby="rules-title">
        <div className="wrap rules-grid">
          <div className="sign sign-teal sign-big taped">
            <h2 id="rules-title" className="h2">Kelmagan bloklanadi.</h2>
            <p>Asosiy qoida shu. Qabul qilingan smenaga kelmagan ishchi platformadan chiqariladi. Biznes e’lon qo‘yganda odam keladi, siz esa reytingingiz bilan ishonch qozonasiz.</p>
          </div>
          <div className="sheet rules-sheet">
            <h3>Bozor qoidalari</h3>
            <ul className="rules-list">
              {RULES.map(([title, text]) => <li key={title}><strong>{title}</strong> {text}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <NextSign href="/bizneslar" title="Bizneslar uchun" tone="ink" />
    </>
  );
}
