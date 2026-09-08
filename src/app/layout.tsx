import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import { PwaRegistrar } from "@/components/pwa/PwaRegistrar";
import { QuickNav } from "@/components/nav/QuickNav";
import { QueryProvider } from "@/lib/query-provider";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
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
export const metadata: Metadata = {
  title: "VerbaLibera · Daily practice path",
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
      className={`${newsreader.variable} ${instrumentSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <QueryProvider>
          {children}
          <QuickNav />
          <PwaRegistrar />
        </QueryProvider>
      </body>
    </html>
  );
}
