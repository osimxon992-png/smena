import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="asosiy">{children}</main>
      <Footer />
    </>
  );
}
