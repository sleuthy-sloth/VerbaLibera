import { z } from "zod";

export { APP_PORT, APP_ORIGIN } from "../security/urls";

const localChoiceSchema = z
  .object({
    mode: z.literal("local"),
    schemaVersion: z.string().min(1),
  })
  .strict();

const remoteChoiceSchema = z
  .object({
    mode: z.literal("remote"),
    encryptedDatabaseUrl: z.string().min(1),
    schemaVersion: z.string().min(1),
  })
  .strict();

const storageChoiceSchema = z.union([localChoiceSchema, remoteChoiceSchema]);

export const desktopSettingsSchema = z
  .object({
    version: z.literal(1),
    active: storageChoiceSchema,
    pending: storageChoiceSchema.optional(),
  })
  .strict();

export type StorageChoice = z.infer<typeof storageChoiceSchema>;
export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Validates a user-supplied remote PostgreSQL URL. Returns the parsed URL. */
export function validateRemoteDatabaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Remote database URL is not a valid URL.");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Remote database URL must use the postgres protocol.");
  }
  if (!url.username || !url.password) {
    throw new Error("Remote database URL must include credentials.");
  }
  if (!url.pathname || url.pathname === "/") {
    throw new Error("Remote database URL must name a database.");
  }
  if (!isLoopback(url.hostname)) {
    const sslmode = url.searchParams.get("sslmode") ?? "";
    if (!["require", "verify-ca", "verify-full"].includes(sslmode)) {
      throw new Error(
        "Remote database connections require TLS (sslmode=require or stronger).",
      );
    }
  }
  return url;
}
