const SECRET_PATTERNS: RegExp[] = [
  // Database URLs with embedded credentials.
  /postgres(?:ql)?:\/\/[^/\s@]*@[^\s"']*/gi,
  // Explicit connection-string assignments.
  /DATABASE_URL\s*=\s*[^\s"']+/gi,
  // Token/secret key=value pairs.
  /\b(?:token|jwt|session|secret|password|passwd|api[_-]?key)\s*=\s*[^\s"';,}]+/gi,
  // Session cookie values.
  /\bverbalibera_session\s*=\s*[^;\s"']+/gi,
  // Bearer credentials.
  /\bBearer\s+[A-Za-z0-9\-._~+/=]+/g,
];

/** Redacts credentials and secrets from a single log line. */
export function redactLogLine(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}
