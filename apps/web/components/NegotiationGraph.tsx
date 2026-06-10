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
const H = 560;
const CX = W / 2;
const CY = H / 2 + 4;

function short(name: string, n = 18) {
  return name.length > n ? name.slice(0, n - 1) + "…" : name;
}

export default function NegotiationGraph({ vendors, winner, live, decision }: Props) {
  const shown = vendors.slice(0, 6);
  const n = Math.max(shown.length, 1);

  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!live) {
      setRound(3);
      return;
    }
    setRound(0);
    const t = setInterval(() => setRound((r) => (r + 1) % 3), 2600);
    return () => clearInterval(t);
  }, [live]);

  const rx = 372;
  const ry = 178;
  const pos = shown.map((_, i) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: CX + rx * Math.cos(ang), y: CY + ry * Math.sin(ang) };
  });

  const buyerSpeaking = round === 1;
  const vendorsSpeaking = round === 0 || round === 2;
  const isFinal = round === 3;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-6">
      {/* round caption + progress */}
      <div className="mb-1 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((r) => (
            <span
              key={r}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                isFinal || r <= round ? "w-8 bg-accent-blue" : "w-3 bg-border"
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

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 540 }}>
        <defs>
          {/* node depth gradients */}
          <radialGradient id="g-vendor" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f0ece2" />
          </radialGradient>
          <radialGradient id="g-buyer" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#5d7488" />
            <stop offset="100%" stopColor="#3f4f5e" />
          </radialGradient>
          <radialGradient id="g-winner" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#d27a57" />
            <stop offset="100%" stopColor="#b5563a" />
          </radialGradient>
          {pos.map((p, i) => (
            <path
              key={i}
              id={`edge-${i}`}
              d={`M ${p.x} ${p.y} Q ${(p.x + CX) / 2 + (CY - p.y) * 0.14} ${(p.y + CY) / 2 + (p.x - CX) * 0.14} ${CX} ${CY}`}
              fill="none"
            />
          ))}
        </defs>

        {/* edges */}
        {pos.map((p, i) => {
          const isWinnerEdge = isFinal && shown[i].name === winner;
          const activeEdge = !isFinal;
          const dim = isFinal && !isWinnerEdge;
          return (
            <use
              key={`e${i}`}
              href={`#edge-${i}`}
              stroke={isWinnerEdge ? "var(--accent-blue)" : "var(--border)"}
              strokeWidth={isWinnerEdge ? 2.5 : 1.4}
              opacity={dim ? 0.35 : activeEdge ? 0.9 : 0.6}
              className={isWinnerEdge ? "edge-dashed" : undefined}
            />
          );
        })}

        {/* flowing particle streams along the active edges */}
        {!isFinal &&
          pos.map((_, i) =>
            [0, 0.85, 1.7].map((delay, k) => (
              <circle
                key={`p${i}-${k}`}
                r={k === 0 ? 5 : 3.2}
                fill={buyerSpeaking ? "var(--accent-purple)" : "var(--accent-blue)"}
                opacity={k === 0 ? 0.95 : 0.5}
              >
                <animateMotion
                  dur="2.55s"
                  repeatCount="indefinite"
                  keyPoints={buyerSpeaking ? "1;0" : "0;1"}
                  keyTimes="0;1"
                  calcMode="linear"
                  begin={`${delay}s`}
                >
                  <mpath href={`#edge-${i}`} />
                </animateMotion>
              </circle>
            ))
          )}
        {isFinal &&
          winner &&
          pos.map((_, i) =>
            shown[i].name === winner
              ? [0, 0.8].map((delay, k) => (
                  <circle key={`pw${i}-${k}`} r={k === 0 ? 5.5 : 3.5} fill="var(--accent-blue)" opacity={k === 0 ? 1 : 0.5}>
                    <animateMotion dur="1.7s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" begin={`${delay}s`}>
                      <mpath href={`#edge-${i}`} />
                    </animateMotion>
                  </circle>
                ))
              : null
          )}

        {/* vendor nodes */}
        {pos.map((p, i) => {
          const v = shown[i];
          const isWinner = isFinal && v.name === winner;
          const dim = isFinal && !isWinner;
          const speaking = vendorsSpeaking && !isFinal;
          const floatClass = buyerSpeaking ? "tk-shake" : "tk-float";
          return (
            <g key={`v${i}`} opacity={dim ? 0.4 : 1} className={floatClass} style={{ animationDelay: `${i * 0.7}s` }}>
              {(speaking || isWinner) && (
                <circle cx={p.x} cy={p.y} r={46} fill={isWinner ? "var(--accent-blue)" : "var(--node-vendor)"} className="tk-nodeglow" />
              )}
              {speaking && <circle cx={p.x} cy={p.y} r={34} fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" className="tk-ring" />}
              <circle
                cx={p.x}
                cy={p.y}
                r={isWinner ? 35 : 31}
                fill={isWinner ? "url(#g-winner)" : "url(#g-vendor)"}
                stroke={isWinner ? "var(--accent-blue)" : "var(--border)"}
                strokeWidth={isWinner ? 3 : 1.5}
                className={isWinner ? "tk-claim" : undefined}
              />
              <text x={p.x} y={p.y + 1} textAnchor="middle" fontSize="19" fill={isWinner ? "#fff" : "var(--text-secondary)"}>
                🍽
              </text>
              {typeof v.score === "number" && (
                <>
                  <circle cx={p.x + 25} cy={p.y - 23} r={13.5} fill={isWinner ? "var(--accent-blue)" : "#fff"} stroke="var(--border)" strokeWidth="1" />
                  <text x={p.x + 25} y={p.y - 19} textAnchor="middle" fontSize="11" fontWeight="700" fill={isWinner ? "#fff" : "var(--text-secondary)"}>
                    {v.score}
                  </text>
                </>
              )}
              <text x={p.x} y={p.y + (p.y > CY ? 53 : -45)} textAnchor="middle" fontSize="14" fontWeight={isWinner ? 700 : 500} fill="var(--text-primary)">
                {short(v.name)}
              </text>
              {isWinner && (
                <text x={p.x} y={p.y + (p.y > CY ? 70 : -62)} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent-blue)" letterSpacing="0.06em">
                  ✓ PICKED
                </text>
              )}
            </g>
          );
        })}

        {/* buyer node (center) with rotating energy halo */}
        <g>
          <g className="tk-spin" style={{ transformOrigin: `${CX}px ${CY}px` }}>
            <circle cx={CX} cy={CY} r={64} fill="none" stroke="var(--accent-purple)" strokeWidth="1.5" strokeDasharray="3 10" opacity={0.5} />
          </g>
          {buyerSpeaking && <circle cx={CX} cy={CY} r={62} fill="var(--accent-purple)" className="tk-nodeglow" />}
          {buyerSpeaking && <circle cx={CX} cy={CY} r={48} fill="none" stroke="var(--accent-purple)" strokeWidth="2" className="tk-ring" />}
          <circle cx={CX} cy={CY} r={46} fill="url(#g-buyer)" stroke="#fff" strokeWidth="3" />
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="22" fill="#fff">🛡</text>
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
            Buyer
          </text>
        </g>
      </svg>
    </div>
  );
}
