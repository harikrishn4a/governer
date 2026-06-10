"use client";

import type { VendorInput, ArgCard } from "@/components/NegotiationForceGraph";

const COLOR: Record<VendorInput["state"] | "buyer", string> = {
  buyer: "#4E6173",
  candidate: "#C2BBAA",
  relevant: "#9A917E",
  pruned: "#C8674B",
  winner: "#C15F3C",
  dim: "#D2CCBF",
};

interface Props {
  vendors: VendorInput[];
  activeMode: "none" | "all" | "winner";
  winnerId?: string;
  cards: ArgCard[];
  height?: number;
}

/** 2D radial fallback when WebGL is unavailable (sandboxed browser, GPU off, etc.). */
export default function NegotiationGraph2D({
  vendors,
  activeMode,
  winnerId,
  cards,
  height = 560,
}: Props) {
  const leftCards = cards.filter((c) => c.side === "left").slice(-5);
  const rightCards = cards.filter((c) => c.side === "right").slice(-5);
  const n = Math.max(vendors.length, 1);
  const cx = 50;
  const cy = 52;
  const ring = 32;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-[#F6F4EF] shadow-sm"
      style={{ height }}
    >
      <p className="absolute left-0 right-0 top-3 z-20 text-center text-[0.72rem] font-medium text-text-muted">
        2D view — WebGL unavailable in this browser
      </p>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {vendors.map((v, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(angle) * ring;
          const y = cy + Math.sin(angle) * ring;
          const active =
            activeMode === "all" || (activeMode === "winner" && v.id === winnerId);
          return (
            <line
              key={`link-${v.id}`}
              x1={x}
              y1={y}
              x2={cx}
              y2={cy}
              stroke={active ? "#CF9079" : "#DAD5C8"}
              strokeWidth={active ? 0.35 : 0.2}
              strokeOpacity={0.7}
            />
          );
        })}
      </svg>

      <div
        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
        style={{ left: `${cx}%`, top: `${cy}%` }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-[0.65rem] font-bold text-white shadow-md"
          style={{ backgroundColor: COLOR.buyer, borderColor: COLOR.buyer }}
        >
          Buyer
        </div>
        <span className="mt-1 text-[0.7rem] font-semibold text-text-primary">Buyer Agent</span>
      </div>

      {vendors.map((v, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * ring;
        const y = cy + Math.sin(angle) * ring;
        const size = v.state === "winner" ? 52 : 44;
        return (
          <div
            key={v.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div
              className="flex items-center justify-center rounded-full border-2 font-semibold text-white shadow-sm"
              style={{
                width: size,
                height: size,
                backgroundColor: COLOR[v.state],
                borderColor: COLOR[v.state],
                fontSize: v.state === "winner" ? "0.7rem" : "0.62rem",
              }}
            >
              {v.name.slice(0, 2).toUpperCase()}
            </div>
            <span
              className={`mt-1 max-w-[88px] truncate text-center text-[0.68rem] font-medium ${
                v.state === "pruned" ? "text-[#A2422F] line-through" : "text-text-primary"
              }`}
            >
              {v.name}
            </span>
          </div>
        );
      })}

      <CardStack cards={leftCards} side="left" />
      <CardStack cards={rightCards} side="right" />
    </div>
  );
}

const SLOT = 96;

function CardStack({ cards, side }: { cards: ArgCard[]; side: "left" | "right" }) {
  const ordered = [...cards].reverse();
  return (
    <div className={`pointer-events-none absolute top-10 h-[480px] w-[300px] ${side === "left" ? "left-5" : "right-5"}`}>
      {ordered.map((c, i) => {
        const buyer = c.side === "left";
        return (
          <div
            key={c.id}
            className={`absolute left-0 right-0 rounded-xl border p-3.5 shadow-md transition-all duration-500 ease-out ${
              buyer ? "border-accent-purple-subtle bg-[#eef0f3]" : "border-border bg-surface"
            } ${i === 0 ? "tk-cardin" : ""}`}
            style={{
              transform: `translateY(${i * SLOT}px)`,
              opacity: Math.max(0.12, 1 - i * 0.22),
              zIndex: 50 - i,
            }}
          >
            <p
              className={`mb-1 text-[0.66rem] font-semibold uppercase tracking-wide ${
                buyer ? "text-accent-purple" : "text-accent-blue"
              }`}
            >
              {buyer ? "🛡 " : "🍽 "}
              {c.speaker}
            </p>
            <p className="line-clamp-3 text-[0.82rem] leading-snug text-text-secondary">{c.text}</p>
          </div>
        );
      })}
    </div>
  );
}
