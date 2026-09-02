import 'server-only';

export const MAX_AUDIO_BYTES = 1_000_000;
const SUPPORTED_LANGUAGES = new Set(['fr', 'it']);
const ACCEPTED_AUDIO_TYPES = new Set(['audio/webm', 'audio/wav']);

type FetchImplementation = typeof fetch;

export type VoiceHealth = Readonly<{ available: boolean }>;

export type VoiceTranscriptionResult =
  | Readonly<{ status: 'ok'; transcript: string }>
  | Readonly<{ status: 'no_speech' }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'invalid_request' }>;

export type VoiceServiceOptions = Readonly<{
  serviceUrl?: string;
  fetchImpl?: FetchImplementation;
}>;

function localServiceUrl(serviceUrl?: string): string | undefined {
  const configuredUrl = serviceUrl ?? process.env.VOXLIBRE_VOICE_SERVICE_URL;
  return configuredUrl?.trim() || undefined;
}

function localEndpoint(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function isAudioPart(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value !== 'string' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string'
  );
}

function forwardableVoiceFormData(formData: FormData): FormData | undefined {
  const audio = formData.get('audio');
  const language = formData.get('language');
  if (
    !isAudioPart(audio) ||
    audio.size > MAX_AUDIO_BYTES ||
    !ACCEPTED_AUDIO_TYPES.has(audio.type) ||
    typeof language !== 'string' ||
    !SUPPORTED_LANGUAGES.has(language)
  ) {
    return undefined;
  }

  const sanitized = new FormData();
  sanitized.set('audio', audio, 'response.webm');
  sanitized.set('language', language);
  return sanitized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseHealth(value: unknown): VoiceHealth {
  return isRecord(value) && value.status === 'ok' ? { available: true } : { available: false };
}

function parseTranscription(value: unknown): VoiceTranscriptionResult {
  if (!isRecord(value)) {
    return { status: 'unavailable' };
  }
  if (value.status === 'no_speech') {
    return { status: 'no_speech' };
  }
  if (value.status === 'ok' && typeof value.transcript === 'string' && value.transcript.trim()) {
    return { status: 'ok', transcript: value.transcript };
  }
  return { status: 'unavailable' };
}

/** Returns only a boolean capability signal; local model details remain server-side. */
export async function getVoiceHealth(
  options: VoiceServiceOptions = {},
): Promise<VoiceHealth> {
  const serviceUrl = localServiceUrl(options.serviceUrl);
  if (!serviceUrl) {
    return { available: false };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(localEndpoint(serviceUrl, '/health'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return { available: false };
    }
    return parseHealth(await response.json());
  } catch {
    return { available: false };
  }
}

/**
 * Proxies a short, explicitly submitted response to the optional local service.
 * Raw learner audio is never logged or persisted by this boundary.
 */
export async function transcribeVoiceResponse(
  formData: FormData,
  options: VoiceServiceOptions = {},
): Promise<VoiceTranscriptionResult> {
  const outboundFormData = forwardableVoiceFormData(formData);
  if (!outboundFormData) {
    return { status: 'invalid_request' };
  }

  const serviceUrl = localServiceUrl(options.serviceUrl);
  if (!serviceUrl) {
    return { status: 'unavailable' };
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      localEndpoint(serviceUrl, '/transcribe'),
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: outboundFormData,
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      return { status: 'unavailable' };
    }
    return parseTranscription(await response.json());
  } catch {
    return { status: 'unavailable' };
  }
}
