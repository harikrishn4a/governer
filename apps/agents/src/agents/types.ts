export interface UserIntent {
  raw: string;
  category?: string;
  location?: string;
  budget?: number;
  currency?: string;
  constraints?: string[];
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

export interface AgentEvent {
  type:
    | "agent:start"
    | "agent:thinking"
    | "agent:tool_call"
    | "agent:tool_result"
    | "agent:complete"
    | "error";
  agent: string;
  data: unknown;
  timestamp: string;
}
