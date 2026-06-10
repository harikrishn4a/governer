export interface UserIntent {
  raw: string;
  category?: string;
  location?: string;
  budget?: number;
  currency?: string;
  constraints?: string[];
  travel?: TravelDetails;
}

export interface TravelDetails {
  origin?: string;
  destination?: string;
  departureDate?: string;
  passengers?: number;
  cabin?: string;
  directOnly?: boolean;
}

export interface PaymentIntent {
  id: string;
  vendor: string;
  item: string;
  description: string;
  price: number;
  currency: string;
  link: string;
  order_url: string;
  imageUrl?: string;
  why_pick?: string;
  metadata: Record<string, string>;
}

export interface SupplierPitch {
  vendorId: string;
  vendor: string;
  item: string;
  price: number;
  pitch: string;
  keyPoints: string[];
  fitScore: number;
  llmUsed: string;
}

export interface NegotiationTurn {
  speaker: string;
  message: string;
}

export interface NegotiationRound {
  round: string;
  entries: NegotiationTurn[];
}

export interface RankingEntry {
  vendor: string;
  item: string;
  price: number;
  score: number;
  withinBudget: boolean;
  reasoning: string;
}

export interface WinnerPaymentIntent extends PaymentIntent {
  procurementRationale: string;
  score: number;
  withinBudget: boolean;
  rankedAlternatives: PaymentIntent[];
  // Full negotiation transcript + ranked scoreboard from the negotiation API,
  // surfaced to the UI so the real back-and-forth can be shown.
  conversation?: NegotiationRound[];
  ranking?: RankingEntry[];
}

export interface SpendingContract {
  id: string;
  name: string;
  budgetCap: number;
  budgetPeriod: "per_transaction" | "daily" | "weekly" | "monthly";
  categoryConstraints: string[];
  vendorBlocklist: string[];
  vendorAllowlist: string[];
  riskThreshold: "low" | "medium" | "strict";
  active: boolean;
  createdAt: string;
}

export interface GovernanceDecision {
  decision: "ACCEPT" | "BLOCK";
  rationale: string;
  contractId: string;
  checkedRules: Array<{
    rule: string;
    passed: boolean;
    detail: string;
  }>;
  requiresHumanReview: boolean;
  stripePaymentIntentId?: string;
}

export interface AuditEvent {
  id: string;
  contractId: string;
  transactionId: string;
  userIntent: string;
  vendor: string;
  item: string;
  price: number;
  decision: "ACCEPT" | "BLOCK";
  rationale: string;
  requiresHumanReview: boolean;
  overriddenBy?: string;
  stripePaymentIntentId?: string;
  createdAt: string;
}

// ── Auction mode ─────────────────────────────────────────────────────────────

export interface VendorProfile {
  slug: string;          // "traveloka" → SSE agent name "bidder_traveloka"
  name: string;
  domains: string[];     // Exa includeDomains + discovered-result → vendor matching
  character: string;     // persona paragraph injected into the bidder system prompt
  biddingPolicy: string; // prompt-encoded policy text — no code enforcement by design
  source: "prebuilt" | "researched";
}

export interface TenderBroadcast {
  id: string;            // = txId
  intent: UserIntent;
  budget?: number;
  currency: string;
  category: "flight" | "generic";
  maxRounds: number;
}

export interface VendorAnchor {
  vendorId: string;
  vendor: string;
  publishedPrice: number; // real price discovered by Exa — every bid anchors to this
  currency: string;
  itemSummary: string;    // e.g. "SIN→KUL direct, 1 adult, 11 Jun"
  sourceUrl: string;
}

export interface VendorBid {
  vendorId: string;
  vendor: string;
  round: number;
  price: number;
  valueAdds: string[];
  pitch: string;
  canImprove: boolean;
  conditions?: string;    // e.g. AirAsia "promo fare valid only if you commit now"
  carriedForward?: boolean; // true when this round's LLM call failed and the prior bid was kept
}

export interface AuctionRound {
  round: number;
  kind: "sealed" | "final";
  bids: VendorBid[];
}

export interface AuctionEvaluation {
  ranking: RankingEntry[];
  verdict: string;
  winnerVendorId: string;
}

export interface AuctionOutcome {
  tender: TenderBroadcast;
  anchors: VendorAnchor[];
  skipped: Array<{ vendor: string; reason: string }>;
  bidders: Array<{ slug: string; name: string; source: "prebuilt" | "researched" }>;
  rounds: AuctionRound[];
  evaluation: AuctionEvaluation;
  winner: WinnerPaymentIntent;
}

export interface AgentEvent {
  type:
    | "agent:start"
    | "agent:thinking"
    | "agent:tool_call"
    | "agent:tool_result"
    | "agent:complete"
    | "auction:anchor"
    | "auction:round_start"
    | "auction:bid"
    | "auction:round_complete"
    | "bidder:skipped"
    | "error";
  agent: string;
  data: unknown;
  timestamp: string;
}
