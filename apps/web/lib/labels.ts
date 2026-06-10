/**
 * User-facing vocabulary for system enums (design audit P5).
 * Raw values like "per_transaction" or "ACCEPT" must never reach the screen —
 * map them here so both pages speak the same language.
 */

/** Noun form — "SGD 100 / monthly", contract cards, budget headers. */
export const PERIOD_LABEL: Record<string, string> = {
  per_transaction: "per transaction",
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};

/** Sentence form — "42.00 of 100.00 SGD used this week" (budget meter). */
export const PERIOD_USED_LABEL: Record<string, string> = {
  per_transaction: "per transaction",
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

/** Governance decision badges and filters. */
export const DECISION_LABEL: Record<string, string> = {
  ACCEPT: "Accepted",
  BLOCK: "Blocked",
};

export function periodLabel(period: string): string {
  return PERIOD_LABEL[period] ?? period.replace(/_/g, " ");
}

export function decisionLabel(decision: string): string {
  return DECISION_LABEL[decision] ?? decision;
}
