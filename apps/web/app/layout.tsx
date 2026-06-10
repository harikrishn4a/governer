import type { Metadata } from "next";
import { Sora, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Type system — see DESIGN-SYSTEM.md §6.
// display: geometric, large only (Avant Garde spirit + dramatic weight contrast).
const display = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// ui: realist grotesque, screen-legible at small sizes (Ch 3). The app default.
const ui = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

// mono: same superfamily as ui → guaranteed pairing harmony. Logs, IDs, prices.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentBid — AI Procurement",
  description: "Multi-agent agentic procurement system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${mono.variable}`}
    >
      {/* No global chrome: the sidebar is the shell on "/", the dashboard renders
        * its own header. One Wordmark per page (see components/Wordmark.tsx). */}
      <body className="min-h-screen bg-bg font-sans text-text-primary">
        <main>{children}</main>
      </body>
    </html>
  );
}
