'use client';

import { useEffect, useState } from 'react';
import type { CourseEnvironment, OfflineInstallablePack } from './environment';

/** What the shared download control needs beyond the install shape. Both
 * `CoursePack` and `RuntimePack` satisfy this structurally. */
export type OfflineDownloadPack = OfflineInstallablePack & {
  title: string;
  lessons: readonly unknown[];
};

export function OfflineDownload({ pack, language, environment }: {
  pack: OfflineDownloadPack; language: string; environment: CourseEnvironment;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const name = pack.title.replace(/ foundations$/, '');

  useEffect(() => {
    let active = true;
    if (location.hash === '#offline-download') document.getElementById('offline-download')?.scrollIntoView();
    (environment.isInstalled?.(language) ?? Promise.resolve(false))
      .then(value => { if (active) setDownloaded(value); })
      .catch(() => { if (active) setError('Could not check saved downloads. Download again while connected.'); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [environment, language]);

  return (
    <section id="offline-download" className="study-download" aria-labelledby="download-title">
      <div className="study-download-heading">
        <div>
          <h2 id="download-title">Download {name} for offline study</h2>
          <p>{pack.lessons.length} lessons, practice and recorded audio. Save this language on this device before you go offline.</p>
        </div>
        <span className="study-download-state" aria-live="polite">
          {installing ? 'Saving your language…' : checking ? 'Checking this device…' : downloaded ? 'Downloaded on this device' : 'Not downloaded yet'}
        </span>
      </div>
      <div className="study-actions">
        <button className="study-primary" disabled={installing || checking} onClick={async () => {
          setInstalling(true);
          setError('');
          try {
            if (!environment.install) throw new Error('Offline installation is unavailable in this browser.');
            await environment.install(pack, language);
            setDownloaded(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Download failed. Retry when connected.');
          } finally {
            setInstalling(false);
          }
        }}>
          {installing ? 'Downloading…' : downloaded ? 'Download again' : 'Download for offline study'}
        </button>
        {downloaded ? <a href={`/study.html?language=${language}`}>Open offline study</a> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <details>
        <summary>How to use downloads in the installed app (PWA)</summary>
        <ol>
          <li>Download each language you want while connected. Wait for “Downloaded on this device”.</li>
          <li>On iPhone or iPad, use Safari’s Share menu → Add to Home Screen. In other browsers, use the browser’s Install app option when available.</li>
          <li>Open the installed app and check or download the language there too. Browser and installed-app storage can differ.</li>
          <li>Use “Open offline study”. If the app opens to the offline welcome page, choose your downloaded language there.</li>
        </ol>
        <p>Installing the app icon does not download lessons. Downloads stay on this device; clearing browser data removes them. Keep a practice backup below.</p>
      </details>
    </section>
  );
}
