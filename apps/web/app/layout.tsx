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
      <body className="min-h-screen bg-bg font-sans text-text-primary">
        <nav className="border-b border-border bg-surface px-6 py-3 flex items-center gap-6">
          <span className="font-display text-body-lg font-extrabold tracking-tight text-text-primary">
            AgentBid
          </span>
          <a href="/" className="font-sans text-label text-text-secondary hover:text-text-primary">
            Procure
          </a>
          <a href="/dashboard" className="font-sans text-label text-text-secondary hover:text-text-primary">
            Dashboard
          </a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
