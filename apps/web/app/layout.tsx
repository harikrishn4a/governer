import type { Metadata } from "next";
import "./globals.css";

// Type system — see DESIGN-SYSTEM.md §6. Font families are defined as CSS
// variables (--font-display/--font-ui/--font-mono) in globals.css using
// self-hosted/system stacks, so the app builds without a next/font network fetch
// (works offline and behind SSL-intercepting proxies).

export const metadata: Metadata = {
  title: "AgentBid — AI Procurement",
  description: "Multi-agent agentic procurement system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans text-text-primary">
        <nav className="flex items-center gap-7 border-b border-border bg-surface/80 px-7 py-3.5 backdrop-blur">
          <span className="font-serif text-[1.15rem] font-semibold tracking-tight text-text-primary">
            Agent<span className="text-accent-blue">Bid</span>
          </span>
          <a href="/" className="text-[0.85rem] text-text-secondary transition-colors hover:text-text-primary">
            Procure
          </a>
          <a href="/dashboard" className="text-[0.85rem] text-text-secondary transition-colors hover:text-text-primary">
            Dashboard
          </a>
          <a href="/business" className="text-[0.85rem] text-text-secondary transition-colors hover:text-text-primary">
            Business
          </a>
          <a href="/user" className="text-[0.85rem] text-text-secondary transition-colors hover:text-text-primary">
            Negotiate
          </a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
