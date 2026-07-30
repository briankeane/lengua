// Small app-card mocks that illustrate each feature. Decorative only.
export type FeatureArtKind = 'deck' | 'schedule' | 'voice';

function Deck() {
  const cards = [
    { en: 'the bill please', es: 'la cuenta, por favor', due: 'due now' },
    { en: 'receipt', es: 'el recibo', due: 'in 4 days' },
    { en: 'hangover', es: 'resaca', due: 'in 9 days' },
  ];
  return (
    <div className="lp-mock lp-mock--deck">
      {cards.map((c) => (
        <div key={c.en} className="lp-mock__row">
          <div>
            <p className="lp-mock__en">{c.en}</p>
            <p className="lp-mock__es">{c.es}</p>
          </div>
          <span className="lp-mock__chip">{c.due}</span>
        </div>
      ))}
    </div>
  );
}

function Schedule() {
  const items = [
    { es: 'pedir prestado', when: 'now', pct: 100 },
    { es: 'no importa', when: '2 days', pct: 62 },
    { es: 'el recibo', when: '4 days', pct: 40 },
    { es: 'resaca', when: '9 days', pct: 18 },
  ];
  return (
    <div className="lp-mock lp-mock--schedule">
      {items.map((i) => (
        <div key={i.es} className="lp-mock__sched">
          <span className="lp-mock__es">{i.es}</span>
          <span className="lp-mock__bar">
            <span className="lp-mock__fill" style={{ width: `${i.pct}%` }} />
          </span>
          <span className="lp-mock__when">{i.when}</span>
        </div>
      ))}
    </div>
  );
}

function Voice() {
  return (
    <div className="lp-mock lp-mock--voice">
      <p className="lp-mock__prompt">¿puede repetirlo?</p>
      <div className="lp-mock__wave" aria-hidden="true">
        {[8, 16, 24, 14, 30, 20, 34, 18, 26, 12, 22, 10].map((h, idx) => (
          <span key={idx} style={{ height: `${h}px` }} />
        ))}
      </div>
      <span className="lp-mock__chip lp-mock__chip--live">Listening…</span>
    </div>
  );
}

export default function FeatureArt({ kind }: { kind: FeatureArtKind }) {
  return (
    <div className="lp-feature__art" aria-hidden="true">
      {kind === 'deck' && <Deck />}
      {kind === 'schedule' && <Schedule />}
      {kind === 'voice' && <Voice />}
    </div>
  );
}
