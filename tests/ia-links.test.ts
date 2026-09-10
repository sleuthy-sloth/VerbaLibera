import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '@/features/course-pack/catalog.json';
import { initialCourses } from '@/features/curriculum/fixture';

/**
 * Internal-link guard.
 *
 * `/learn/french`, `/learn/french/placement` and `/learn/french/plan` all
 * returned HTTP 200 with a five-word stub ("This course is not available in
 * preview.") — a soft 404 that looked broken but reported success, and which the
 * axe audit scored as clean because a nearly-empty page has nothing to violate.
 * `/learn/*` is keyed by `english-to-<language>`; the foundation course pages are
 * keyed by bare `<language>`. Mixing the two slug spaces is the failure mode this
 * pins, along with any href that points at a route that does not exist.
 */

const SRC = join(process.cwd(), 'src');
const APP = join(SRC, 'app');

function walk(dir: string, filter: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, filter));
    else if (filter(entry.name)) found.push(full);
  }
  return found;
}

/** Route patterns from the app directory: [segment] becomes a single-segment wildcard. */
function routePatterns(): RegExp[] {
  return walk(APP, (name) => name === 'page.tsx').map((file) => {
    const route = file
      .replace(APP, '')
      .replace(/\/page\.tsx$/, '')
      .split('/')
      .filter(Boolean)
      .map((segment) =>
        segment.startsWith('[')
          ? '[^/]+'
          : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/');
    return new RegExp(`^/${route}/?$`);
  });
}

type Link = { href: string; file: string; /** true when the path came from a template literal */ dynamic: boolean };

function internalLinks(): Link[] {
  const found: Link[] = [];
  for (const file of walk(SRC, (name) => name.endsWith('.tsx') || name.endsWith('.ts'))) {
    const source = readFileSync(file, 'utf8');
    const rel = file.replace(`${process.cwd()}/`, '');

    // Plain literals: href="/x" and href={'/x'}.
    for (const match of source.matchAll(/href=(?:"|')\/([^"'#?]*)/g)) {
      found.push({ href: `/${match[1]}`.replace(/\/$/, '') || '/', file: rel, dynamic: false });
    }
    // Template literals: href={`/learn/${slug}/plan`} -> a wildcard pattern.
    for (const match of source.matchAll(/href=\{`(\/[^`]*)`\}/g)) {
      const raw = match[1];
      if (!raw.startsWith('/')) continue;
      found.push({ href: raw, file: rel, dynamic: true });
    }
  }
  return found;
}

/** A dynamic href becomes a regex; a literal one is compared directly. */
function asPattern(link: Link): RegExp {
  if (!link.dynamic) return new RegExp(`^${link.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const source = link.href
    .split(/(\$\{[^}]*\})/)
    .map((part) => (part.startsWith('${') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}/?$`);
}

describe('internal links', () => {
  it('every internal href matches a real route', () => {
    const patterns = routePatterns();
    const broken = internalLinks().filter((link) => {
      // Static files (study.html, /sw.js) and bare roots are not app routes.
      if (/\.[a-z]+/.test(link.href.split('/')[1] ?? '')) return false;
      const pattern = asPattern(link);
      return !patterns.some((route) => {
        if (route.test(link.href)) return true;
        // A dynamic template can still be satisfied by a dynamic route: check
        // that some route accepts the same shape.
        return link.dynamic && route.source.split('[^/]+').length > 1 && new RegExp(route.source).test(link.href.replace(/\$\{[^}]*\}/g, 'x'));
      });
    });
    const report = broken.map(({ href, file }) => `${href} (${file})`).join('\n');
    expect(broken, `Links with no matching route:\n${report}`).toHaveLength(0);
  });

  it('never mixes the two course slug spaces', () => {
    // `/learn/*` takes english-to-<language>; `/courses/*` takes <language>.
    const guidedSlugs = new Set(initialCourses.map((course) => course.slug));
    const foundationSlugs = new Set(catalog.map((entry) => entry.slug));
    const offences: string[] = [];

    for (const link of internalLinks()) {
      // Only first literal segment can be validated; `${...}` is not a slug.
      const learn = link.href.match(/^\/learn\/([^/]+)/);
      if (learn && !learn[1].includes('$') && !guidedSlugs.has(learn[1])) {
        offences.push(`/learn/${learn[1]} (${link.file}) — not a guided-course slug (expected english-to-*)`);
      }
      const course = link.href.match(/^\/courses\/([^/]+)/);
      if (course && !course[1].includes('$') && !foundationSlugs.has(course[1])) {
        offences.push(`/courses/${course[1]} (${link.file}) — not a foundation course slug`);
      }
    }

    expect(offences, `Course links using the wrong slug space:\n${offences.join('\n')}`).toHaveLength(0);
  });

  it('scans a plausible number of links', () => {
    // Break caught: a regex change silently makes the guards above vacuous.
    expect(internalLinks().length).toBeGreaterThan(20);
    expect(routePatterns().length).toBeGreaterThan(8);
  });
});
