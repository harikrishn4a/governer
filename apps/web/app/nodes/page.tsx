"use client";

import { useEffect, useState } from "react";
import NegotiationGraph from "@/components/NegotiationGraph";

type Stage = "reveal" | "negotiate" | "verdict";

const ALL = [
  { name: "Mad Mex", score: 84 },
  { name: "Guzman y Gomez", score: 80 },
  { name: "Baja Fresh", score: 78 },
  { name: "Chimi's - Marina Bay", score: 70 },
  { name: "Super Loco", score: 65 },
];

const STAGE_COPY: Record<Stage, string> = {
  reveal: "Agents discovered — assembling the negotiation table.",
  negotiate: "Live negotiation: vendors pitch, the buyer agent challenges, vendors defend.",
  verdict: "Verdict reached — the buyer agent crowns the winner.",
};

export default function NodesDemo() {
  const [revealed, setRevealed] = useState(0);
  const [stage, setStage] = useState<Stage>("reveal");
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    setRevealed(0);
    setStage("reveal");

    ALL.forEach((_, i) => timers.push(setTimeout(() => setRevealed(i + 1), 360 * (i + 1))));
    const revealDone = 360 * ALL.length + 400;
    timers.push(setTimeout(() => setStage("negotiate"), revealDone));
    timers.push(setTimeout(() => setStage("verdict"), revealDone + 9200));
    timers.push(setTimeout(() => setRunId((r) => r + 1), revealDone + 9200 + 6000)); // loop

    return () => timers.forEach(clearTimeout);
  }, [runId]);

  const isVerdict = stage === "verdict";
  const vendors = isVerdict
    ? ALL
    : ALL.slice(0, revealed).map((v) => ({ name: v.name }));

  return (
    <div className="min-h-[calc(100vh-53px)] bg-bg px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">
              Animation preview
            </p>
            <h1 className="font-serif mt-2 text-[2.2rem] font-semibold leading-tight tracking-tight text-text-primary">
              The negotiation, visualised.
            </h1>
            <p className="mt-2 max-w-xl text-[0.96rem] leading-relaxed text-text-secondary">
              A standalone, looping preview of the live agent negotiation graph — no
              backend run required. {STAGE_COPY[stage]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["reveal", "negotiate", "verdict"] as Stage[]).map((s) => (
              <span
                key={s}
                className={`rounded-full px-3 py-1 text-[0.74rem] font-medium ${
                  stage === s ? "bg-accent-blue text-text-inverse" : "border border-border text-text-muted"
                }`}
              >
                {s}
              </span>
            ))}
            <button
              onClick={() => setRunId((r) => r + 1)}
              className="rounded-lg border border-border bg-surface px-4 py-1.5 text-[0.82rem] font-medium text-text-secondary transition hover:border-accent-blue hover:text-text-primary"
            >
              ↻ Replay
            </button>
          </div>
        </div>

        <div className="mt-6">
          <NegotiationGraph
            vendors={vendors}
            winner={isVerdict ? "Mad Mex" : undefined}
            live={!isVerdict}
            decision={isVerdict ? "ACCEPT" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
