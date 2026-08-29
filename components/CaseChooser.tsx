type CaseOption = {
  slug: string;
  question: string;
  subtitle: string;
  recommended: boolean;
};

export function CaseChooser({ cases }: { cases: CaseOption[] }) {
  return (
    <main className="case-chooser">
      <header>
        <span className="brand-mark">SG</span>
        <div><b>SIGNALGRAPH</b><small>INVESTIGACIONES VISUALES</small></div>
      </header>
      <section>
        <p className="chooser-kicker">ELIGE UNA PREGUNTA</p>
        <h1>¿De qué hilo tiramos?</h1>
        <p className="chooser-intro">Cada pregunta abre un reparto distinto. El agente elige las entidades; tú decides por dónde continuar.</p>
        <div className="case-options">
          {cases.map((item, index) => (
            <Link href={`/?case=${encodeURIComponent(item.slug)}`} key={item.slug} className={item.recommended ? "is-recommended" : undefined}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                {item.recommended && <small>DEMO PRINCIPAL</small>}
                <h2>{item.question}</h2>
                <p>{item.subtitle}</p>
              </div>
              <b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
import Link from "next/link";
