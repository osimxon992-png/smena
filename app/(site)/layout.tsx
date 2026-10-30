import Header from '@/components/site/Header';
import Footer from '@/components/site/Footer';
import Farbo from '@/components/Farbo';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="asosiy">{children}</main>
      <Footer />
      <Farbo />
    </>
  );
}
