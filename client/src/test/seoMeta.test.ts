import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vitest runs with the client dir as cwd, so index.html is at the root.
const html = readFileSync('index.html', 'utf8');

describe('index.html marketing meta', () => {
  it('has a descriptive title and description', () => {
    expect(html).toMatch(/<title>Lengua[^<]+<\/title>/);
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{40,}"/);
  });

  it('has Open Graph and Twitter card tags', () => {
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('name="twitter:card"');
  });

  it('has a canonical link and theme color', () => {
    expect(html).toContain('rel="canonical"');
    expect(html).toMatch(/name="theme-color"\s+content="#2C4EBD"/i);
  });
});
