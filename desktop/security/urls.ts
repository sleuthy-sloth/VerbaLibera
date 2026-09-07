export const APP_PORT = 43127;
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;

/** The renderer may only ever load the fixed local application origin. */
export function isAllowedRendererUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.origin === APP_ORIGIN;
}
