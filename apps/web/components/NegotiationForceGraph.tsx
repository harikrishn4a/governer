"use client";

import { useEffect, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";

// This component is loaded client-only (via next/dynamic ssr:false on the page),
// so the static three / force-graph imports never run on the server.

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
const KEEP = 5; // first 5 survive the relevance filter
const WINNER_ID = "s0";

function endId(v: string | GNode): string {
  return typeof v === "string" ? v : v.id;
}

const COLOR: Record<NodeState, string> = {
  buyer: "#4E6173",
  candidate: "#C2BBAA",
  relevant: "#9A917E",
  pruned: "#C8674B",
  winner: "#C15F3C",
  dim: "#D2CCBF",
};

export default function NegotiationForceGraph({ onStage }: { onStage?: (s: Stage) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [runId, setRunId] = useState(0);

  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [graph, setGraph] = useState<{ nodes: GNode[]; links: GLink[] }>({ nodes: [], links: [] });
  const sync = () => setGraph({ nodes: [...nodesRef.current], links: [...linksRef.current] });
  const fit = () => fgRef.current?.zoomToFit(900, 80);

  // Spread the layout out for a clean ring.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-360);
    fg.d3Force("link")?.distance(115);
  }, []);

  // responsive width
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // lifecycle: discovery -> pruning -> negotiate -> verdict -> (loop)
  useEffect(() => {
    const t: ReturnType<typeof setTimeout>[] = [];
    nodesRef.current = [{ id: "buyer", name: "Buyer Agent", kind: "buyer", state: "buyer", fx: 0, fy: 0, fz: 0 }];
    linksRef.current = [];
    sync();
    onStage?.("discovery");

    // spawn candidates one by one (Exa surfacing options)
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
    // promote survivors to "relevant"
    t.push(
      setTimeout(() => {
        nodesRef.current.forEach((n) => {
          if (n.kind === "supplier" && Number(n.id.slice(1)) < KEEP) n.state = "relevant";
        });
        sync();
        fit();
        onStage?.("pruning");
      }, afterSpawn)
    );
    // prune irrelevant: flash, then drop
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

    const afterPrune = afterSpawn + 300 + (SUPPLIERS.length - KEEP) * 520 + 700;
    // negotiation: info streams into the buyer node
    t.push(
      setTimeout(() => {
        linksRef.current.forEach((l) => (l.active = true));
        sync();
        fit();
        onStage?.("negotiate");
      }, afterPrune)
    );

    const verdictAt = afterPrune + 7200;
    t.push(
      setTimeout(() => {
        nodesRef.current.forEach((n) => {
          if (n.kind === "supplier") n.state = n.id === WINNER_ID ? "winner" : "dim";
        });
        linksRef.current.forEach((l) => (l.active = endId(l.source) === WINNER_ID));
        sync();
        fit();
        onStage?.("verdict");
      }, verdictAt)
    );

    // loop
    t.push(setTimeout(() => setRunId((r) => r + 1), verdictAt + 5600));
    return () => t.forEach(clearTimeout);
  }, [runId, onStage]);

  return (
    <div ref={wrapRef} className="overflow-hidden rounded-2xl border border-border bg-[#F6F4EF] shadow-sm">
      <ForceGraph3D
        graphData={graph}
        width={width}
        height={540}
        backgroundColor="#F6F4EF"
        showNavInfo={false}
        cooldownTicks={80}
        onEngineStop={() => fgRef.current?.zoomToFit?.(600, 60)}
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
          s.position.y = g.kind === "buyer" ? 13 : 9;
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
    </div>
  );
}
