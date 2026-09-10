import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
};

/**
 * Without this file Next renders its built-in 404: five words of body text and
 * nothing else — no brand, no navigation, no way back. Any mistyped or retired
 * route (and `/learn/<lang>/*` had three) landed there.
 */
export default function NotFound() {
  return (
    <main id="main-content" className="not-found">
      <p className="not-found-eyebrow">VerbaLibera</p>
      <h1>That page isn&rsquo;t here.</h1>
      <p>
        The link may be old, or the address may have a typo. Nothing is broken about your
        practice — this is just a page we can&rsquo;t find.
      </p>
      <ul className="not-found-links">
        <li>
          <Link href="/dashboard">Today&rsquo;s practice path</Link>
        </li>
        <li>
          <Link href="/courses">Browse courses</Link>
        </li>
        <li>
          <Link href="/listen">Audio lessons</Link>
        </li>
      </ul>
    </main>
  );
}
