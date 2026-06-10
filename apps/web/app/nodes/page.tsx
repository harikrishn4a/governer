"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { Stage } from "@/components/NegotiationForceGraph";

// Three.js / WebGL — load only in the browser.
const NegotiationForceGraph = dynamic(() => import("@/components/NegotiationForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[540px] items-center justify-center rounded-2xl border border-border bg-[#F6F4EF] text-text-muted">
      Loading 3D graph…
    </div>
  ),
});

const STAGE_COPY: Record<Stage, string> = {
  discovery: "Exa is surfacing candidate suppliers from across the live web…",
  pruning: "Filtering out vendors that don't match the request…",
  negotiate: "Negotiation underway — each vendor drives its case into your buyer agent.",
  verdict: "Verdict reached — the buyer agent commits to the winning vendor.",
};

export default function NodesDemo() {
  const [stage, setStage] = useState<Stage>("discovery");
  const onStage = useCallback((s: Stage) => setStage(s), []);

  return (
    <div className="min-h-[calc(100vh-53px)] bg-bg px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
              Animation preview · 3D
            </p>
            <h1 className="font-serif mt-2 text-[2.2rem] font-semibold leading-tight tracking-tight text-text-primary">
              The negotiation, in three dimensions.
            </h1>
            <p className="mt-2 max-w-2xl text-[0.96rem] leading-relaxed text-text-secondary">
              A live, looping 3D force graph — suppliers spawn as Exa discovers them, irrelevant
              ones are pruned away, and during negotiation information streams into the central
              buyer agent. Drag to orbit; scroll to zoom.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["discovery", "pruning", "negotiate", "verdict"] as Stage[]).map((s) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-[0.72rem] font-medium transition-colors ${
                  stage === s ? "bg-accent-blue text-text-inverse" : "border border-border text-text-muted"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 mb-3 text-[0.9rem] font-medium text-text-secondary">{STAGE_COPY[stage]}</p>

        <NegotiationForceGraph onStage={onStage} />
      </div>
    </div>
  );
}
