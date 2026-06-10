"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import ForceGraph3D from "react-force-graph-3d";
import SpriteText from "three-spritetext";
import NegotiationGraph2D from "@/components/NegotiationGraph2D";
import { isWebGLAvailable } from "@/lib/webgl";

export type NodeState = "candidate" | "relevant" | "pruned" | "winner" | "dim";
export interface VendorInput {
  id: string;
  name: string;
  state: NodeState;
}
export interface ArgCard {
  id: number;
  side: "left" | "right";
  speaker: string;
  text: string;
}

type FullState = NodeState | "buyer";
interface GNode {
  id: string;
  name: string;
  kind: "buyer" | "supplier";
  state: FullState;
  fx?: number;
  fy?: number;
  fz?: number;
}
interface GLink {
  source: string | GNode;
  target: string | GNode;
  active: boolean;
}

const COLOR: Record<FullState, string> = {
  buyer: "#4E6173",
  candidate: "#C2BBAA",
  relevant: "#9A917E",
  pruned: "#C8674B",
  winner: "#C15F3C",
  dim: "#D2CCBF",
};

interface Props {
  vendors: VendorInput[];
  /** which links stream particles into the buyer */
  activeMode: "none" | "all" | "winner";
  winnerId?: string;
  cards: ArgCard[];
  autoRotate?: boolean;
  height?: number;
}

class GraphErrorBoundary extends Component<
  { children: ReactNode; onError: () => void; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function NegotiationForceGraph(props: Props) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  const fallback = <NegotiationGraph2D {...props} />;

  if (webglOk === null) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-border bg-[#F6F4EF] text-text-muted"
        style={{ height: props.height ?? 560 }}
      >
        Loading graph…
      </div>
    );
  }

  if (!webglOk || renderFailed) return fallback;

  return (
    <GraphErrorBoundary onError={() => setRenderFailed(true)} fallback={fallback}>
      <ForceGraph3DInner {...props} />
    </GraphErrorBoundary>
  );
}

function ForceGraph3DInner({
  vendors,
  activeMode,
  winnerId,
  cards,
  autoRotate = true,
  height = 560,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const prevIdsRef = useRef("");
  const [graph, setGraph] = useState<{ nodes: GNode[]; links: GLink[] }>({ nodes: [], links: [] });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-360);
    fg.d3Force("link")?.distance(115);
    const c = fg.controls?.();
    if (c) {
      c.autoRotate = autoRotate;
      c.autoRotateSpeed = 1.1;
    }
  }, [width, autoRotate]);

  const sig = vendors.map((v) => `${v.id}:${v.state}`).join("|") + `#${activeMode}#${winnerId ?? ""}`;
  useEffect(() => {
    if (!nodesRef.current.find((n) => n.id === "buyer")) {
      nodesRef.current.push({ id: "buyer", name: "Buyer Agent", kind: "buyer", state: "buyer", fx: 0, fy: 0, fz: 0 });
    }
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    const desired = new Set<string>(["buyer", ...vendors.map((v) => v.id)]);
    for (const v of vendors) {
      const ex = byId.get(v.id);
      if (ex) {
        ex.name = v.name;
        ex.state = v.state;
      } else {
        nodesRef.current.push({ id: v.id, name: v.name, kind: "supplier", state: v.state });
      }
    }
    nodesRef.current = nodesRef.current.filter((n) => desired.has(n.id));
    linksRef.current = vendors.map((v) => ({
      source: v.id,
      target: "buyer",
      active: activeMode === "all" || (activeMode === "winner" && v.id === winnerId),
    }));
    setGraph({ nodes: [...nodesRef.current], links: [...linksRef.current] });

    const ids = [...desired].sort().join(",");
    if (ids !== prevIdsRef.current) {
      prevIdsRef.current = ids;
      setTimeout(() => fgRef.current?.zoomToFit?.(700, 60), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const leftCards = cards.filter((c) => c.side === "left").slice(-5);
  const rightCards = cards.filter((c) => c.side === "right").slice(-5);

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-2xl border border-border bg-[#F6F4EF] shadow-sm">
      <ForceGraph3D
        ref={fgRef}
        graphData={graph}
        width={width}
        height={height}
        backgroundColor="#F6F4EF"
        showNavInfo={false}
        controlType="orbit"
        cooldownTicks={80}
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
          const s: any = new SpriteText(g.kind === "buyer" ? g.name : `${g.name} Agent`);
          s.color = g.state === "pruned" ? "#A2422F" : g.state === "dim" ? "#A7A192" : "#1A1813";
          s.textHeight = g.kind === "buyer" ? 5 : 3.6;
          s.fontWeight = g.kind === "buyer" || g.state === "winner" ? "700" : "500";
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
