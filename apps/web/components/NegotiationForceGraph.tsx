"use client";

import { useEffect, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";

type NodeState = "buyer" | "candidate" | "relevant" | "pruned" | "winner" | "dim";

interface GNode {
  id: string;
  name: string;
  kind: "buyer" | "supplier";
  state: NodeState;
  fx?: number;
  fy?: number;
  fz?: number;
}
interface GLink {
  source: string | GNode;
  target: string | GNode;
  active: boolean;
}
interface ArgCard {
  id: number;
  side: "left" | "right";
  speaker: string;
  text: string;
}

export type Stage = "discovery" | "pruning" | "negotiate" | "verdict";

const SUPPLIERS = [
  "Mad Mex",
  "Guzman y Gomez",
  "Baja Fresh",
  "Chimi's",
  "Super Loco",
  "Stuff'd",
  "Burrito Bros",
  "Cali Mex",
  "El Patrón",
];
const KEEP = 5;
const WINNER_ID = "s0";

// The negotiation transcript that drives the side cards (and node activity).
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

const COLOR: Record<NodeState, string> = {
  buyer: "#4E6173",
  candidate: "#C2BBAA",
  relevant: "#9A917E",
  pruned: "#C8674B",
  winner: "#C15F3C",
  dim: "#D2CCBF",
};

function endId(v: string | GNode): string {
  return typeof v === "string" ? v : v.id;
}

export default function NegotiationForceGraph({ onStage }: { onStage?: (s: Stage) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [runId, setRunId] = useState(0);

  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const lockFrameRef = useRef(false); // stop re-framing once negotiation begins (so auto-rotate is smooth)
  const cardSeq = useRef(0);
  const [graph, setGraph] = useState<{ nodes: GNode[]; links: GLink[] }>({ nodes: [], links: [] });
  const [cards, setCards] = useState<ArgCard[]>([]);
  const sync = () => setGraph({ nodes: [...nodesRef.current], links: [...linksRef.current] });

  // responsive width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // forces + camera auto-rotate
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-360);
    fg.d3Force("link")?.distance(115);
    const c = fg.controls?.();
    if (c) {
      c.autoRotate = true;
      c.autoRotateSpeed = 1.1;
    }
  }, [width]);

  // lifecycle: discovery -> pruning -> negotiate -> verdict -> (loop)
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    lockFrameRef.current = false;
    nodesRef.current = [{ id: "buyer", name: "Buyer Agent", kind: "buyer", state: "buyer", fx: 0, fy: 0, fz: 0 }];
    linksRef.current = [];
    setCards([]);
    sync();
    onStage?.("discovery");

    // spawn candidates (Exa surfacing options)
    SUPPLIERS.forEach((name, i) => {
      t.push(
        setTimeout(() => {
          nodesRef.current.push({ id: `s${i}`, name, kind: "supplier", state: "candidate" });
          linksRef.current.push({ source: `s${i}`, target: "buyer", active: false });
          sync();
        }, 430 * (i + 1))
      );
    });

    const afterSpawn = 430 * SUPPLIERS.length + 650;
    t.push(
      setTimeout(() => {
        nodesRef.current.forEach((n) => {
          if (n.kind === "supplier" && Number(n.id.slice(1)) < KEEP) n.state = "relevant";
        });
        sync();
        onStage?.("pruning");
      }, afterSpawn)
    );
    for (let k = KEEP; k < SUPPLIERS.length; k++) {
      const at = afterSpawn + 300 + (k - KEEP) * 520;
      t.push(setTimeout(() => { const n = nodesRef.current.find((x) => x.id === `s${k}`); if (n) n.state = "pruned"; sync(); }, at));
      t.push(
        setTimeout(() => {
          nodesRef.current = nodesRef.current.filter((x) => x.id !== `s${k}`);
          linksRef.current = linksRef.current.filter((l) => endId(l.source) !== `s${k}` && endId(l.target) !== `s${k}`);
          sync();
        }, at + 470)
      );
    }

    const afterPrune = afterSpawn + 300 + (SUPPLIERS.length - KEEP) * 520 + 800;
    // negotiation: all info streams to the buyer + arguments pop onto the side stacks
    t.push(
      setTimeout(() => {
        lockFrameRef.current = true; // freeze framing so auto-rotate is uninterrupted
        linksRef.current.forEach((l) => (l.active = true));
        sync();
        onStage?.("negotiate");
      }, afterPrune)
    );
    ARGUMENTS.forEach((a, i) => {
      t.push(
        setTimeout(() => {
          const side = a.speaker === "Buyer Agent" ? "left" : "right";
          setCards((prev) => [...prev, { id: cardSeq.current++, side, speaker: a.speaker, text: a.text }]);
        }, afterPrune + 400 + i * 1900)
      );
    });

    const verdictAt = afterPrune + 400 + ARGUMENTS.length * 1900 + 600;
    t.push(
      setTimeout(() => {
        nodesRef.current.forEach((n) => {
          if (n.kind === "supplier") n.state = n.id === WINNER_ID ? "winner" : "dim";
        });
        linksRef.current.forEach((l) => (l.active = endId(l.source) === WINNER_ID));
        sync();
        onStage?.("verdict");
      }, verdictAt)
    );

    t.push(setTimeout(() => setRunId((r) => r + 1), verdictAt + 6000));
    return () => t.forEach(clearTimeout);
  }, [runId, onStage]);

  const leftCards = cards.filter((c) => c.side === "left").slice(-5);
  const rightCards = cards.filter((c) => c.side === "right").slice(-5);

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-border bg-[#F6F4EF] shadow-sm">
      <ForceGraph3D
        ref={fgRef}
        graphData={graph}
        width={width}
        height={560}
        backgroundColor="#F6F4EF"
        showNavInfo={false}
        controlType="orbit"
        cooldownTicks={80}
        onEngineStop={() => {
          if (!lockFrameRef.current) fgRef.current?.zoomToFit?.(600, 60);
        }}
        nodeRelSize={6}
        nodeResolution={22}
        nodeOpacity={0.96}
        nodeVal={(n: object) => {
          const g = n as GNode;
          return g.kind === "buyer" ? 30 : g.state === "winner" ? 16 : 8;
        }}
        nodeColor={(n: object) => COLOR[(n as GNode).state]}
        nodeThreeObjectExtend
        nodeThreeObject={(n: object) => {
          const g = n as GNode;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const s: any = new SpriteText(g.name);
          s.color = g.state === "pruned" ? "#A2422F" : g.state === "dim" ? "#A7A192" : "#1A1813";
          s.textHeight = g.kind === "buyer" ? 5 : 3.6;
          s.fontWeight = g.kind === "buyer" || g.state === "winner" ? "700" : "500";
          // Sit the label just ABOVE the sphere (radius = cbrt(nodeVal) * nodeRelSize).
          const val = g.kind === "buyer" ? 30 : g.state === "winner" ? 16 : 8;
          const radius = Math.cbrt(val) * 6;
          s.position.y = radius + 7;
          return s;
        }}
        linkColor={(l: object) => ((l as GLink).active ? "#CF9079" : "#DAD5C8")}
        linkWidth={(l: object) => ((l as GLink).active ? 1.6 : 0.5)}
        linkOpacity={0.55}
        linkDirectionalParticles={(l: object) => ((l as GLink).active ? 4 : 0)}
        linkDirectionalParticleColor={() => "#C15F3C"}
        linkDirectionalParticleWidth={2.6}
        linkDirectionalParticleSpeed={0.012}
        enableNodeDrag
      />

      {/* layered argument cards — buyer on the left, vendors on the right */}
      <CardStack cards={leftCards} side="left" />
      <CardStack cards={rightCards} side="right" />
    </div>
  );
}

const SLOT = 96; // vertical spacing between stacked cards

function CardStack({ cards, side }: { cards: ArgCard[]; side: "left" | "right" }) {
  // Newest first, spread downward; each older card fades a step further.
  const ordered = [...cards].reverse();
  return (
    <div
      className={`pointer-events-none absolute top-10 h-[480px] w-[300px] ${side === "left" ? "left-5" : "right-5"}`}
    >
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
            <p className={`mb-1 text-[0.66rem] font-semibold uppercase tracking-wide ${buyer ? "text-accent-purple" : "text-accent-blue"}`}>
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
