import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  BOOTSTRAP_COOKIE,
  forwardedClient,
  hasDesktopOrigin,
  isLocalDesktopMode,
  isLoopbackHost,
  readCookie,
} from "@/lib/desktop/config";
import { verifyBootstrapSecret } from "@/lib/desktop/bootstrap";
import {
  getSessionCookieName,
  issueSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, csrfCookieOptions, generateCsrfToken, validateCsrfRequest } from "@/lib/auth/csrf";
import { withObserve } from "@/lib/observe";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const bodySchema = z.object({ profileId: z.string().min(1).max(64) });

async function postHandler(request: Request): Promise<NextResponse> {
  if (!isLocalDesktopMode()) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const forwarded = forwardedClient(request);
  if (forwarded && !isLoopbackHost(forwarded)) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  if (!hasDesktopOrigin(request)) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  if (!verifyBootstrapSecret(readCookie(request, BOOTSTRAP_COOKIE))) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  if (!validateCsrfRequest(request)) {
    return NextResponse.json({ status: "forbidden" }, { status: 403, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400, headers: NO_STORE });
  }
  const profile = await prisma.desktopProfile.findUnique({
    where: { userId: parsed.data.profileId },
    include: { user: true },
  });
  if (!profile || !profile.user.isDesktopLocal) {
    return NextResponse.json({ status: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const token = await issueSessionToken(profile.user.id);
  const csrfToken = generateCsrfToken();
  const response = NextResponse.json(
    { status: "ok", redirect: "/dashboard" },
    { headers: NO_STORE },
  );
  response.cookies.set(getSessionCookieName(), token, sessionCookieOptions() as never);
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions() as never);
  // One-shot bootstrap: the per-launch secret is consumed on selection.
  response.cookies.set(BOOTSTRAP_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export const POST = withObserve("/api/desktop/bootstrap", postHandler);
