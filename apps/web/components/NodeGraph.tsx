"use client";

import { useEffect, useState } from "react";
import type { GraphState, Phase } from "@/lib/useAgentStream";

interface NodeGraphProps {
  /** Live graph state from useAgentStream. Falls back to an idle mock if omitted. */
  graphState?: GraphState;
  /** Right-anchor node label = the selected contract's name. */
  contractName?: string;
  /** Demo mode: ignore graphState and cycle every phase every 2s. */
  mockMode?: boolean;
}

/* viewBox coordinate space. Node divs are positioned as a % of these dimensions,
 * and the container holds the same 600×450 (4:3) aspect ratio, so the SVG edges
 * and the DOM nodes stay pixel-aligned at any width. */
const VB_W = 600;
const VB_H = 450;
const BROADCAST = { x: 80, y: 225 }; // left-center
const CONTRACT = { x: 520, y: 225 }; // right-center
const VENDOR_X = 300; // center column
const V_TOP = 95;
const V_BOTTOM = 355;

const PHASE_ORDER: Record<Phase, number> = {
  idle: 0,
  broadcasting: 1,
  pitching: 2,
  deciding: 3,
  verifying: 4,
  complete: 5,
};

const MOCK_VENDORS = ["Acme Foods", "Marina Grill", "Hawker Lane", "Satay Bros", "Kopi & Co"];
const MOCK_CYCLE: Phase[] = ["idle", "broadcasting", "pitching", "deciding", "verifying", "complete"];

function truncate(s: string, n = 12) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function vendorY(i: number, n: number) {
  if (n <= 1) return (V_TOP + V_BOTTOM) / 2;
  return V_TOP + ((V_BOTTOM - V_TOP) * i) / (n - 1);
}

function pos(x: number, y: number): React.CSSProperties {
  return { left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` };
}

function coreStyle(color: string, size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    border: `1.5px solid ${color}`,
    boxShadow: `inset 0 0 14px color-mix(in srgb, ${color} 22%, transparent)`,
  };
}

export default function NodeGraph({ graphState, contractName, mockMode = false }: NodeGraphProps) {
  const [mockIdx, setMockIdx] = useState(0);

  useEffect(() => {
    if (!mockMode) return;
    const id = setInterval(() => setMockIdx((i) => (i + 1) % MOCK_CYCLE.length), 2000);
    return () => clearInterval(id);
  }, [mockMode]);

  const state: GraphState = mockMode
    ? { phase: MOCK_CYCLE[mockIdx], vendors: MOCK_VENDORS, winner: MOCK_VENDORS[1] }
    : graphState ?? { phase: "idle", vendors: [], winner: undefined };

  const { phase, vendors, winner } = state;
  const order = PHASE_ORDER[phase];

  const showVendors = order >= PHASE_ORDER.broadcasting;
  const showContract = order >= PHASE_ORDER.broadcasting;
  const showDashed = showVendors && phase !== "complete";
  const showSolid = order >= PHASE_ORDER.deciding;
  const pitching = phase === "pitching";
  const verifying = phase === "verifying";
  const complete = phase === "complete";

  const positions = vendors.map((v, i) => ({ v, i, y: vendorY(i, vendors.length) }));
  const isWinner = (v: string) => !!winner && v.toLowerCase() === winner.toLowerCase();

  return (
    <div
      className="relative w-full aspect-[4/3] overflow-hidden rounded-xl border border-border-subtle bg-surface/30"
      role="img"
      aria-label={`Procurement graph — ${phase}`}
    >
      {/* Edges (behind nodes). */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Broadcast → each vendor: dashed, flowing. */}
        {showDashed &&
          positions.map(({ i, y }) => (
            <line
              key={`d-${i}`}
              x1={BROADCAST.x}
              y1={BROADCAST.y}
              x2={VENDOR_X}
              y2={y}
              className="edge-dashed"
              stroke="var(--node-broadcast)"
              strokeWidth={1.5}
              style={{ opacity: 0.5 }}
            />
          ))}

        {/* Each vendor → contract: solid, draws in during "deciding". */}
        {showSolid &&
          positions.map(({ v, i, y }) => {
            const win = complete && isWinner(v);
            const dim = complete && !isWinner(v);
            return (
              <line
                key={`s-${i}`}
                x1={VENDOR_X}
                y1={y}
                x2={CONTRACT.x}
                y2={CONTRACT.y}
                pathLength={1}
                className="edge-draw"
                stroke={win ? "var(--node-winner)" : "var(--node-vendor)"}
                strokeWidth={win ? 2 : 1.5}
                style={{ opacity: dim ? 0.15 : 0.8 }}
              />
            );
          })}
      </svg>

      {/* Broadcast node — origin, always present, slow heartbeat. */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(BROADCAST.x, BROADCAST.y)}>
        <div className="relative grid place-items-center">
          <span className="node-glow animate-glow" style={{ background: "var(--node-broadcast)" }} />
          <div className="animate-heartbeat grid place-items-center rounded-full" style={coreStyle("var(--node-broadcast)", 64)}>
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--node-broadcast)" }} />
          </div>
        </div>
        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-overline uppercase text-text-muted">
          Broadcast
        </span>
      </div>

      {/* Vendor nodes — center column, staggered entrance. */}
      {showVendors &&
        positions.map(({ v, i, y }) => {
          const win = complete && isWinner(v);
          const lose = complete && !isWinner(v);
          const color = win ? "var(--node-winner)" : "var(--node-vendor)";
          const glowClass = win || lose ? "" : pitching ? "animate-glow-fast" : "animate-glow";
          return (
            <div key={`v-${v}-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(VENDOR_X, y)}>
              <div
                className={`animate-vendor-in transition-opacity duration-standard ease-smooth ${lose ? "opacity-30" : "opacity-100"}`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="relative grid place-items-center">
                  <span
                    className={`node-glow ${glowClass}`}
                    style={{ background: color, opacity: win ? 0.6 : undefined }}
                  />
                  <div
                    className={`grid place-items-center rounded-full transition-colors duration-standard ease-smooth ${
                      pitching ? "animate-heartbeat-fast" : ""
                    }`}
                    style={coreStyle(color, 48)}
                  >
                    <span className="line-clamp-2 px-1 text-center text-[9px] leading-[10px] text-text-primary/90">
                      {truncate(v)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

      {/* Contract node — right anchor, pulses while verifying. */}
      {showContract && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(CONTRACT.x, CONTRACT.y)}>
          <div className="relative grid place-items-center">
            <span
              className={`node-glow ${verifying ? "animate-glow" : ""}`}
              style={{ background: "var(--node-contract)", opacity: verifying ? undefined : 0.25 }}
            />
            <div
              className={`grid place-items-center rounded-full ${verifying ? "animate-heartbeat" : ""}`}
              style={coreStyle("var(--node-contract)", 56)}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--node-contract)" }} />
            </div>
          </div>
          <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-center">
            <span className="block text-overline uppercase text-text-muted">Contract</span>
            <span className="block text-caption text-text-secondary">{truncate(contractName ?? "Governance", 14)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
