import { useEffect } from 'react';

const SITE_ORIGIN = 'https://www.lengua-app.com';

type PageMeta = {
  /** Document <title> for this route. */
  title: string;
  /** Path the canonical URL should point at, e.g. "/" or "/privacy". */
  path: string;
  /** When true, adds <meta name="robots" content="noindex">. */
  noindex?: boolean;
};

/**
 * Sets per-route document metadata for the SPA. index.html carries the
 * landing-page defaults, so without this every client-rendered route (e.g.
 * /privacy, /terms) would keep the landing title and canonical URL. Each page
 * sets its own values authoritatively on mount, so navigating between routes
 * updates them correctly.
 */
export function usePageMeta({ title, path, noindex = false }: PageMeta): void {
  useEffect(() => {
    document.title = title;

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', `${SITE_ORIGIN}${path}`);
    }

    const existingRobots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      const robots = existingRobots ?? document.createElement('meta');
      robots.setAttribute('name', 'robots');
      robots.setAttribute('content', 'noindex');
      if (!existingRobots) {
        document.head.appendChild(robots);
      }
    } else if (existingRobots) {
      existingRobots.remove();
    }
  }, [title, path, noindex]);
}
