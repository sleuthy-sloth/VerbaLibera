import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { isLocalDesktopMode } from "@/lib/desktop/config";
import DesktopProfilePicker from "@/components/desktop/DesktopProfilePicker";

export const dynamic = "force-dynamic";

export default async function DesktopProfilesPage() {
  if (!isLocalDesktopMode()) {
    notFound();
  }
  const profiles = await prisma.desktopProfile.findMany({
    orderBy: { displayName: "asc" },
  });
  return (
    <main>
      <h1>Who is learning today?</h1>
      <p>Profiles live only on this Mac.</p>
      <DesktopProfilePicker
        initialProfiles={profiles.map((profile) => ({
          id: profile.userId,
          displayName: profile.displayName,
        }))}
      />
    </main>
  );
}
