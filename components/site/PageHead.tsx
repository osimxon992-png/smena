// Ichki sahifa sarlavhasi: chapda nom va qisqa matn, o'ngda sahifaga mos interaktiv varaq
export default function PageHead({ title, lead, children }: { title: string; lead: string; children?: React.ReactNode }) {
  return (
    <header className="page-head wrap">
      <div className="page-head-grid">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="lead">{lead}</p>
        </div>
        {children}
      </div>
    </header>
  );
}
