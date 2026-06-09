import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBid — AI Procurement",
  description: "Multi-agent agentic procurement system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-slate-900 text-white px-6 py-3 flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">AgentBid</span>
          <a href="/" className="text-slate-300 hover:text-white text-sm">Procure</a>
          <a href="/dashboard" className="text-slate-300 hover:text-white text-sm">Dashboard</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
