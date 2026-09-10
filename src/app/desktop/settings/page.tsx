import type { Metadata } from 'next';
import { notFound } from "next/navigation";

import { isLocalDesktopMode } from "@/lib/desktop/config";
import DesktopSettings from "@/components/desktop/DesktopSettings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: 'Settings',
};

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
