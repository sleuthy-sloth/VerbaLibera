import { notFound } from "next/navigation";

import { isLocalDesktopMode } from "@/lib/desktop/config";
import DesktopSettings from "@/components/desktop/DesktopSettings";

export const dynamic = "force-dynamic";

export default function DesktopSettingsPage() {
  if (!isLocalDesktopMode()) {
    notFound();
  }
  return (
    <main>
      <h1>Desktop storage</h1>
      <DesktopSettings />
    </main>
  );
}
