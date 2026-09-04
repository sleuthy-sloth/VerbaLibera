export const CSRF_COOKIE_NAME = 'verbalibera_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  // base64url encode
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function csrfCookieOptions(): {
  httpOnly: false;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: false as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2, // 2 hours
  };
}

export function validateCsrfRequest(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const headerToken = request.headers.get(CSRF_HEADER_NAME) ?? request.headers.get(CSRF_HEADER_NAME.toLowerCase());
  if (!headerToken) return false;
  // Parse cookie
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  let cookieToken: string | null = null;
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === CSRF_COOKIE_NAME) {
      cookieToken = decodeURIComponent(rest.join('='));
      break;
    }
  }
  if (!cookieToken) return false;
  // Double-submit: header must equal cookie
  return cookieToken === headerToken;
}
