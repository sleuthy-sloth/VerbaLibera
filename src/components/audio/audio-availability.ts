export function isUnavailableAudioUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('unavailable://');
}

export function hasUnavailableAudio(segments: readonly { url: string }[]): boolean {
  return segments.some((segment) => isUnavailableAudioUrl(segment.url));
}
