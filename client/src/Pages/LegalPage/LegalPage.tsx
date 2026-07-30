import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import { EFFECTIVE_DATE, LEGAL, type LegalKind } from './legalContent';

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = LEGAL[kind];
  usePageMeta({ title: `${doc.title} — Lengua`, path: `/${kind}` });

  return (
    <main className="lp lp-legal">
      <h1>{doc.title}</h1>
      <p className="lp-legal__meta">Effective {EFFECTIVE_DATE}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}
