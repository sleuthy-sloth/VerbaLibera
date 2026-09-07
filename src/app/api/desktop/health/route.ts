import "server-only";

import { NextResponse } from "next/server";

import { desktopMode } from "@/lib/desktop/config";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Liveness probe for the Electron supervisor; loopback-bound, never cached. */
export async function GET(): Promise<NextResponse> {
  if (!desktopMode()) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json(
    {
      identity: process.env.VERBALIBERA_HEALTH_IDENTITY ?? "unconfigured",
      version: process.env.VERBALIBERA_APP_VERSION ?? "0.0.0",
    },
    { headers: NO_STORE },
  );
}
