import Link from "next/link";

/**
 * The single brand treatment (design audit P1). Rendered exactly once per page:
 * in the sidebar on the procure page, in the page header on the dashboard.
 * Two-tone "Bid" is the only sanctioned variant — do not restyle per call site.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-display-md font-extrabold tracking-tight text-text-primary ${className}`}
    >
      Agent<span className="text-accent-blue">Bid</span>
    </Link>
  );
}
