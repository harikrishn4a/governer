"use client";

import { useEffect, useState } from "react";

interface VNode {
  name: string;
  score?: number;
}

interface Props {
  vendors: VNode[];
  winner?: string;
  /** true while the run is in progress (rounds cycle); false = final state. */
  live: boolean;
  decision?: "ACCEPT" | "BLOCK";
}

// 0 = vendors pitch, 1 = buyer challenges, 2 = vendors defend, 3 = final.
const ROUND_LABEL = [
  "Vendors pitch their best offer",
  "Your buyer agent challenges every vendor",
  "Vendors defend their case",
  "Verdict reached",
];

const W = 1000;
const H = 540;
const CX = W / 2;
const CY = H / 2 + 6;

function short(name: string, n = 16) {
  return name.length > n ? name.slice(0, n - 1) + "…" : name;
}

export default function NegotiationGraph({ vendors, winner, live, decision }: Props) {
  const shown = vendors.slice(0, 6);
  const n = Math.max(shown.length, 1);

  // Round cycles while live; settles to "final" when done.
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!live) {
      setRound(3);
      return;
    }
    setRound(0);
    const t = setInterval(() => setRound((r) => (r + 1) % 3), 2400);
    return () => clearInterval(t);
  }, [live]);

  const rx = 360;
  const ry = 168;
  const pos = shown.map((_, i) => {
    // Spread vendors around the buyer; start at top, go clockwise.
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: CX + rx * Math.cos(ang), y: CY + ry * Math.sin(ang) };
  });

  const buyerSpeaking = round === 1;
  const vendorsSpeaking = round === 0 || round === 2;
  const isFinal = round === 3;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      {/* round caption */}
      <div className="mb-1 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((r) => (
            <span
              key={r}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                (isFinal || r <= round) ? "w-7 bg-accent-blue" : "w-3 bg-border"
              }`}
            />
          ))}
        </div>
        <span key={round} className="tk-fade text-[0.82rem] font-medium text-text-secondary">
          {isFinal && decision
            ? decision === "ACCEPT"
              ? "Verdict — approved"
              : "Verdict — held for review"
            : ROUND_LABEL[round]}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 520 }}>
        <defs>
          {pos.map((p, i) => (
            // Curved edge from vendor i to the buyer (slight bow for elegance).
            <path
              key={i}
              id={`edge-${i}`}
              d={`M ${p.x} ${p.y} Q ${(p.x + CX) / 2 + (CY - p.y) * 0.12} ${(p.y + CY) / 2 + (p.x - CX) * 0.12} ${CX} ${CY}`}
              fill="none"
            />
          ))}
        </defs>

        {/* edges */}
        {pos.map((p, i) => {
          const isWinnerEdge = isFinal && shown[i].name === winner;
          const dim = isFinal && !isWinnerEdge;
          return (
            <use
              key={`e${i}`}
              href={`#edge-${i}`}
              stroke={isWinnerEdge ? "var(--accent-blue)" : "var(--border)"}
              strokeWidth={isWinnerEdge ? 2.5 : 1.5}
              opacity={dim ? 0.4 : 1}
            />
          );
        })}

        {/* travelling message pulses */}
        {!isFinal &&
          pos.map((_, i) => (
            <circle key={`p${i}`} r={5} fill={buyerSpeaking ? "var(--accent-purple)" : "var(--accent-blue)"}>
              <animateMotion
                dur="1.5s"
                repeatCount="indefinite"
                keyPoints={buyerSpeaking ? "1;0" : "0;1"}
                keyTimes="0;1"
                calcMode="linear"
                begin={`${i * 0.18}s`}
              >
                <mpath href={`#edge-${i}`} />
              </animateMotion>
            </circle>
          ))}
        {isFinal && winner &&
          pos.map((_, i) =>
            shown[i].name === winner ? (
              <circle key={`pw${i}`} r={5.5} fill="var(--accent-blue)">
                <animateMotion dur="1.6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href={`#edge-${i}`} />
                </animateMotion>
              </circle>
            ) : null
          )}

        {/* vendor nodes */}
        {pos.map((p, i) => {
          const v = shown[i];
          const isWinner = isFinal && v.name === winner;
          const dim = isFinal && !isWinner;
          const active = (vendorsSpeaking && !isFinal) || isWinner;
          return (
            <g key={`v${i}`} opacity={dim ? 0.45 : 1} className={buyerSpeaking ? "tk-shake" : undefined}>
              {active && (
                <circle cx={p.x} cy={p.y} r={42} fill={isWinner ? "var(--accent-blue)" : "var(--node-vendor)"} className="tk-nodeglow" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isWinner ? 34 : 30}
                fill="var(--surface)"
                stroke={isWinner ? "var(--accent-blue)" : "var(--border)"}
                strokeWidth={isWinner ? 3 : 1.5}
              />
              <text x={p.x} y={p.y + 1} textAnchor="middle" fontSize="18" fill={isWinner ? "var(--accent-blue)" : "var(--text-secondary)"}>
                🍽
              </text>
              {typeof v.score === "number" && (
                <>
                  <circle cx={p.x + 24} cy={p.y - 22} r={13} fill={isWinner ? "var(--accent-blue)" : "var(--surface-raised)"} stroke="var(--border)" strokeWidth="1" />
                  <text x={p.x + 24} y={p.y - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill={isWinner ? "var(--text-inverse)" : "var(--text-secondary)"}>
                    {v.score}
                  </text>
                </>
              )}
              <text
                x={p.x}
                y={p.y + (p.y > CY ? 52 : -44)}
                textAnchor="middle"
                fontSize="14"
                fontWeight={isWinner ? 700 : 500}
                fill="var(--text-primary)"
              >
                {short(v.name)}
              </text>
              {isWinner && (
                <text x={p.x} y={p.y + (p.y > CY ? 68 : -60)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent-blue)" letterSpacing="0.05em">
                  ✓ PICKED
                </text>
              )}
            </g>
          );
        })}

        {/* buyer node (center) */}
        <g>
          {buyerSpeaking && <circle cx={CX} cy={CY} r={58} fill="var(--accent-purple)" className="tk-nodeglow" />}
          <circle cx={CX} cy={CY} r={46} fill="var(--accent-purple)" stroke="var(--surface)" strokeWidth="3" />
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="22" fill="#fff">🛡</text>
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            Buyer
          </text>
        </g>
      </svg>
    </div>
  );
}
