"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { VendorInput, ArgCard, NodeState } from "@/components/NegotiationForceGraph";

const NegotiationForceGraph = dynamic(() => import("@/components/NegotiationForceGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-2xl border border-border bg-[#F6F4EF] text-text-muted">
      Loading 3D graph…
    </div>
  ),
});

type Stage = "discovery" | "pruning" | "negotiate" | "verdict";

const SUPPLIERS = ["Mad Mex", "Guzman y Gomez", "Baja Fresh", "Chimi's", "Super Loco", "Stuff'd", "Burrito Bros", "Cali Mex", "El Patrón"];
const KEEP = 5;
const WINNER = "s0";

const ARGUMENTS: { speaker: string; text: string }[] = [
  { speaker: "Mad Mex", text: "Small Burrito at SGD 8.90 — fully customizable, right at Marina Bay Financial Centre. Best value, full stop." },
  { speaker: "Buyer Agent", text: "Is “small” really the best, or just the cheapest? Justify the portion size." },
  { speaker: "Guzman y Gomez", text: "Mini Burrito SGD 9.40 — authentic Mexican, made fresh daily, a short walk from MBS." },
  { speaker: "Baja Fresh", text: "Baja Burrito SGD 16.32 — made-from-scratch every day, generous fillings. Quality over cost." },
  { speaker: "Buyer Agent", text: "Two of you undercut on price. What's the real differentiator beyond cost?" },
  { speaker: "Chimi's", text: "Smoked Duck Burrito SGD 16 — a gourmet twist, with alfresco seating over the bay." },
  { speaker: "Super Loco", text: "Veggie Burrito SGD 22 — premium, but the freshest produce of anyone here." },
  { speaker: "Mad Mex", text: "Customisable to any size — base price is just the start. Still the strongest value." },
];

const STAGE_COPY: Record<Stage, string> = {
  discovery: "Exa is surfacing candidate suppliers from across the live web…",
  pruning: "Filtering out vendors that don't match the request…",
  negotiate: "Negotiation underway — each agent drives its case into your buyer agent.",
  verdict: "Verdict reached — the buyer agent commits to the winning agent.",
};

export default function NodesDemo() {
  const [vendors, setVendors] = useState<VendorInput[]>([]);
  const [activeMode, setActiveMode] = useState<"none" | "all" | "winner">("none");
  const [winnerId, setWinnerId] = useState<string | undefined>(undefined);
  const [cards, setCards] = useState<ArgCard[]>([]);
  const [stage, setStage] = useState<Stage>("discovery");
  const [runId, setRunId] = useState(0);
  const cardSeq = useRef(0);

  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    setVendors([]);
    setActiveMode("none");
    setWinnerId(undefined);
    setCards([]);
    setStage("discovery");

    const setState = (id: string, s: NodeState) =>
      setVendors((vs) => vs.map((v) => (v.id === id ? { ...v, state: s } : v)));

    SUPPLIERS.forEach((name, i) => {
      t.push(setTimeout(() => setVendors((vs) => [...vs, { id: `s${i}`, name, state: "candidate" }]), 430 * (i + 1)));
    });

    const afterSpawn = 430 * SUPPLIERS.length + 650;
    t.push(setTimeout(() => {
      setVendors((vs) => vs.map((v) => (Number(v.id.slice(1)) < KEEP ? { ...v, state: "relevant" } : v)));
      setStage("pruning");
    }, afterSpawn));
    for (let k = KEEP; k < SUPPLIERS.length; k++) {
      const at = afterSpawn + 300 + (k - KEEP) * 520;
      t.push(setTimeout(() => setState(`s${k}`, "pruned"), at));
      t.push(setTimeout(() => setVendors((vs) => vs.filter((v) => v.id !== `s${k}`)), at + 470));
    }

    const afterPrune = afterSpawn + 300 + (SUPPLIERS.length - KEEP) * 520 + 800;
    t.push(setTimeout(() => {
      setActiveMode("all");
      setStage("negotiate");
    }, afterPrune));
    ARGUMENTS.forEach((a, i) => {
      t.push(setTimeout(() => {
        const side = a.speaker === "Buyer Agent" ? "left" : "right";
        setCards((prev) => [...prev, { id: cardSeq.current++, side, speaker: a.speaker, text: a.text }]);
      }, afterPrune + 400 + i * 1900));
    });

    const verdictAt = afterPrune + 400 + ARGUMENTS.length * 1900 + 600;
    t.push(setTimeout(() => {
      setVendors((vs) => vs.map((v) => ({ ...v, state: v.id === WINNER ? "winner" : "dim" })));
      setActiveMode("winner");
      setWinnerId(WINNER);
      setStage("verdict");
    }, verdictAt));

    t.push(setTimeout(() => setRunId((r) => r + 1), verdictAt + 6000));
    return () => t.forEach(clearTimeout);
  }, [runId]);

  return (
    <div className="min-h-[calc(100vh-53px)] bg-bg px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-accent-blue">Animation preview · 3D</p>
            <h1 className="font-serif mt-2 text-[2.2rem] font-semibold leading-tight tracking-tight text-text-primary">
              The negotiation, in three dimensions.
            </h1>
            <p className="mt-2 max-w-2xl text-[0.96rem] leading-relaxed text-text-secondary">
              A live, looping 3D force graph — agents spawn as Exa discovers them, irrelevant ones are pruned away,
              and during negotiation each agent's case streams into the central buyer agent. Drag to orbit; scroll to zoom.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["discovery", "pruning", "negotiate", "verdict"] as Stage[]).map((s) => (
              <span key={s} className={`rounded-full px-3 py-1 text-[0.72rem] font-medium transition-colors ${stage === s ? "bg-accent-blue text-text-inverse" : "border border-border text-text-muted"}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 mb-3 text-[0.9rem] font-medium text-text-secondary">{STAGE_COPY[stage]}</p>

        <NegotiationForceGraph vendors={vendors} activeMode={activeMode} winnerId={winnerId} cards={cards} />
      </div>
    </div>
  );
}
