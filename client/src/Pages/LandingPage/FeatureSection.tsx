import FeatureArt, { FeatureArtKind } from './FeatureArt';

export default function FeatureSection({
  feature,
  flip,
}: {
  feature: { art: FeatureArtKind; title: string; body: string };
  flip: boolean;
}) {
  return (
    <section className={`lp-feature ${flip ? 'lp-feature--flip' : ''}`}>
      <div className="lp-container lp-feature__inner">
        <div className="lp-feature__copy">
          <h2 className="lp-feature__title">{feature.title}</h2>
          <p className="lp-feature__body">{feature.body}</p>
        </div>
        <FeatureArt kind={feature.art} />
      </div>
    </section>
  );
}
