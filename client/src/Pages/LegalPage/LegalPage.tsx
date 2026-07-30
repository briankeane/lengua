import { Link } from 'react-router-dom';

export default function LegalPage({ title }: { title: string }) {
  return (
    <main className="lp lp-legal">
      <h1>{title}</h1>
      <p>
        We&rsquo;re finalizing this document. Questions in the meantime?{' '}
        <a href="mailto:hello@lengua-app.com">hello@lengua-app.com</a>.
      </p>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  );
}
