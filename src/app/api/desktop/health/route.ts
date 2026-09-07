import "server-only";

import { NextResponse } from "next/server";

import { desktopMode } from "@/lib/desktop/config";
import { getRpConfig } from "@/lib/auth/webauthn";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Liveness probe for the Electron supervisor; loopback-bound, never cached. */
export async function GET(): Promise<NextResponse> {
  if (!desktopMode()) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const { rpID, origin } = getRpConfig();
  return NextResponse.json(
    {
      identity: process.env.VERBALIBERA_HEALTH_IDENTITY ?? "unconfigured",
      version: process.env.VERBALIBERA_APP_VERSION ?? "0.0.0",
      // Non-secret ceremony values; lets remote-mode setup verify the child
      // server checks passkeys against the fixed loopback origin.
      webauthn: { rpID, origin },
    },
    { headers: NO_STORE },
  );
}
