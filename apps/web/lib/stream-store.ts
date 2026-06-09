// In-memory pub/sub for agent events, keyed by transaction id.
//
// The agents worker POSTs events to /api/stream/ingest, which calls emit().
// /api/stream subscribes per txId and streams events to the browser over SSE.
//
// State is parked on globalThis so it survives Next.js HMR in dev and is shared
// across separate route-handler module instances within the same Node process.
// (This is process-local: it does NOT work across serverless instances — fine
// for the hackathon's single Node server / local dev.)

export type AgentEventType =
  | "agent:start"
  | "agent:thinking"
  | "agent:tool_call"
  | "agent:tool_result"
  | "agent:complete"
  | "error";

export interface StreamEvent {
  type: AgentEventType | string;
  agent: string;
  data?: unknown;
  timestamp: string;
}

// What subscribers receive — the event plus a monotonic seq for client de-dup.
export interface StoredEvent extends StreamEvent {
  seq: number;
}

type Listener = (e: StoredEvent) => void;

interface Stream {
  events: StoredEvent[];
  listeners: Set<Listener>;
  seq: number;
  updatedAt: number;
}

const STREAM_TTL_MS = 10 * 60 * 1000; // prune streams idle for >10 min

const g = globalThis as unknown as { __agentbidStreams?: Map<string, Stream> };
const streams: Map<string, Stream> = (g.__agentbidStreams ??= new Map());

function getOrCreate(txId: string): Stream {
  let s = streams.get(txId);
  if (!s) {
    s = { events: [], listeners: new Set(), seq: 0, updatedAt: Date.now() };
    streams.set(txId, s);
  }
  return s;
}

function prune() {
  const now = Date.now();
  for (const [id, s] of streams) {
    if (s.listeners.size === 0 && now - s.updatedAt > STREAM_TTL_MS) {
      streams.delete(id);
    }
  }
}

/** Store an event for a txId and notify all current subscribers. */
export function emit(txId: string, event: StreamEvent): StoredEvent {
  const s = getOrCreate(txId);
  const stored: StoredEvent = { ...event, seq: ++s.seq };
  s.events.push(stored);
  s.updatedAt = Date.now();
  for (const fn of s.listeners) {
    try {
      fn(stored);
    } catch {
      /* a broken subscriber must not break emit */
    }
  }
  prune();
  return stored;
}

/** Register a listener for a txId. Returns an unsubscribe function. */
export function subscribe(txId: string, fn: Listener): () => void {
  const s = getOrCreate(txId);
  s.listeners.add(fn);
  return () => {
    s.listeners.delete(fn);
    s.updatedAt = Date.now();
  };
}

/** All events stored so far for a txId (for replay on (re)connection). */
export function getEvents(txId: string): StoredEvent[] {
  return streams.get(txId)?.events ?? [];
}
