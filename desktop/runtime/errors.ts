// Machine-readable desktop failures (Task 5).
// Every startup/recovery branch reports one of these codes so the recovery
// window can render the right guidance instead of a raw stack trace.

export type DesktopFailureCode =
  | "APP_PORT_OCCUPIED"
  | "SERVER_HEALTH_TIMEOUT"
  | "SERVER_VERSION_MISMATCH"
  | "LOCAL_DATABASE_UNREADY"
  | "LOCAL_DATABASE_INIT_FAILED"
  | "MIGRATION_FAILED"
  | "REMOTE_TLS_REQUIRED"
  | "REMOTE_MIGRATION_APPROVAL_REQUIRED"
  | "REMOTE_UNREACHABLE"
  | "SETTINGS_CORRUPT"
  | "SCHEMA_TOO_NEW"
  | "ENCRYPTION_UNAVAILABLE";

export interface DesktopFailure extends Error {
  code: DesktopFailureCode;
  detail?: string;
}

export function desktopFailure(
  code: DesktopFailureCode,
  message: string,
  detail?: string,
): DesktopFailure {
  const error = new Error(message) as DesktopFailure;
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  return error;
}
