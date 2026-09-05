/** Read the host-only production cookie first; retain development compatibility. */
export function sessionTokenFromCookies(header: string): string | null {
  const values = new Map(header.split(';').map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), part.slice(index + 1)];
  }));
  const raw = values.get('__Host-verbalibera_session') ?? values.get('verbalibera_session');
  try { return raw ? decodeURIComponent(raw) : null; } catch { return null; }
}

export function csrfHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const cookie = document.cookie.split(';').find(part => part.trim().startsWith('verbalibera_csrf='));
  try {
    return cookie ? { 'x-csrf-token': decodeURIComponent(cookie.trim().slice('verbalibera_csrf='.length)) } : {};
  } catch { return {}; }
}
