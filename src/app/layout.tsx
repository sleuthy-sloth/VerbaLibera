import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { QuickNav } from "@/components/nav/QuickNav";
import { AppHeader } from "@/components/nav/AppHeader";
import { RouteAnnouncer } from "@/components/nav/RouteAnnouncer";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

/**
 * Display face. Warm Studio sets headings in Fraunces — a softer, slightly
 * quirkier serif than the Newsreader it replaces. Everything that asks for
 * `var(--font-display)` follows automatically, and every call site already
 * carries a `Georgia, serif` fallback for the offline bundle.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Notched iPhones need this for env(safe-area-inset-*) to resolve;
  // without it the floating tab capsule can sit under the home indicator.
  viewportFit: "cover",
};

/**
 * Route names announced by RouteAnnouncer on client-side navigation. Every
 * route used to inherit the single title below, so a screen reader had no way
 * to say which page had loaded; per-route `metadata.title` now does the work
 * and this map is the fallback for routes that render a shared title.
 */
const ROUTE_NAMES: Record<string, string> = {
  "/dashboard": "Today's practice path",
  "/courses": "Courses",
  "/listen": "Audio lessons",
  "/you": "Your profile",
  "/login": "Sign in",
};

export const metadata: Metadata = {
  title: {
    default: "VerbaLibera · Daily practice path",
    // Every sub-page used to inherit the title above, so /you, /listen, /login
    // and /courses/* all reported the same name — history, bookmarks and screen
    // readers could not tell them apart.
    template: "%s · VerbaLibera",
  },
  description: "A focused daily path for practical language patterns.",
  metadataBase: new URL("https://verbalibera.vercel.app"),
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "VerbaLibera",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "VerbaLibera · An offline language course that respects you",
    description: "Structured Italian and French A1 lessons with hear-it-first audio. No signup, no AI chatbot, works offline.",
    url: "/",
    siteName: "VerbaLibera",
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: "VerbaLibera — an offline language course that respects you" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VerbaLibera · An offline language course that respects you",
    description: "Structured Italian and French A1 lessons with hear-it-first audio. No signup, no AI chatbot, works offline.",
    images: ["/og-card.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <QueryProvider>
          <AppHeader />
          {children}
          <QuickNav />
          <RouteAnnouncer titles={ROUTE_NAMES} />
          <PwaRegistrar />
        </QueryProvider>
      </body>
    </html>
  );
}
