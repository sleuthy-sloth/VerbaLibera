import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  forwardedClient,
  hasDesktopOrigin,
  isLocalDesktopMode,
  isLoopbackHost,
} from "@/lib/desktop/config";
import { withObserve } from "@/lib/observe";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function guard(request: Request): NextResponse | null {
  if (!isLocalDesktopMode()) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const forwarded = forwardedClient(request);
  if (forwarded && !isLoopbackHost(forwarded)) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  if (!hasDesktopOrigin(request) && request.method !== "GET") {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  return null;
}

async function getHandler(request: Request): Promise<NextResponse> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const profiles = await prisma.desktopProfile.findMany({
    orderBy: { displayName: "asc" },
  });
  return NextResponse.json(
    { profiles: profiles.map((p) => ({ id: p.userId, displayName: p.displayName })) },
    { headers: NO_STORE },
  );
}

const createBody = z.object({ displayName: z.string().trim().min(1).max(40) });

async function postHandler(request: Request): Promise<NextResponse> {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = createBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  const user = await prisma.user.create({
    data: {
      accountIdentifier: `desktop-local:${randomUUID()}`,
      isDesktopLocal: true,
      desktopProfile: { create: { displayName: parsed.data.displayName } },
    },
    include: { desktopProfile: true },
  });
  return NextResponse.json(
    { id: user.id, displayName: user.desktopProfile?.displayName ?? parsed.data.displayName },
    { status: 201, headers: NO_STORE },
  );
}

export const GET = withObserve("/api/desktop/profiles", getHandler);
export const POST = withObserve("/api/desktop/profiles", postHandler);
