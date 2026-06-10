import { v4 as uuidv4 } from "uuid";
import { llmCallJSON } from "../lib/llm";
import { logger } from "../lib/logger";
import { exaSearchAndContents } from "../tools/exa";
import { parseIntent } from "./procurement";
import { runDiscovery } from "./discovery";
import { FLIGHT_VENDORS } from "./vendors/flight-vendors";
import { buildGenericBidders } from "./vendors/generic-vendor";
import type {
  AgentEvent,
  AuctionEvaluation,
  AuctionOutcome,
  AuctionRound,
  RankingEntry,
  TenderBroadcast,
  UserIntent,
  VendorAnchor,
  VendorBid,
  VendorProfile,
  WinnerPaymentIntent,
} from "./types";

type OnEvent = (e: AgentEvent) => Promise<void> | void;

const MAX_ROUNDS = 2;

// ── Phase A helpers — intent ─────────────────────────────────────────────────

const FLIGHT_KEYWORDS = /\b(flight|flights|fly|flying|airline|airfare|air ticket|plane ticket)\b/i;

export function isFlightIntent(intent: UserIntent): boolean {
  const cat = (intent.category ?? "").toLowerCase();
  return (
    cat.includes("flight") ||
    cat.includes("travel") ||
    cat.includes("air") ||
    FLIGHT_KEYWORDS.test(intent.raw)
  );
}

const TRAVEL_DETAILS_SYSTEM = `Extract flight travel details from a purchase intent. Today's date is ${new Date().toISOString().slice(0, 10)} (Singapore).

Return JSON:
{
  "origin": "IATA city or airport, default Singapore if not stated",
  "destination": "city/country the user wants to fly to",
  "departureDate": "YYYY-MM-DD (resolve relative dates like 'tomorrow')",
  "passengers": 1,
  "cabin": "economy unless stated otherwise",
  "directOnly": true/false (true if the user asked for direct/non-stop)
}
Use null for anything not inferable.`;

async function extractTravelDetails(intent: UserIntent): Promise<UserIntent> {
  try {
    const travel = await llmCallJSON<{
      origin?: string | null;
      destination?: string | null;
      departureDate?: string | null;
      passengers?: number | null;
      cabin?: string | null;
      directOnly?: boolean | null;
    }>({
      system: TRAVEL_DETAILS_SYSTEM,
      messages: [{ role: "user", content: intent.raw }],
      maxTokens: 300,
    });
    return {
      ...intent,
      travel: {
        origin: travel.origin ?? "Singapore",
        destination: travel.destination ?? undefined,
        departureDate: travel.departureDate ?? undefined,
        passengers: travel.passengers ?? 1,
        cabin: travel.cabin ?? "economy",
        directOnly: travel.directOnly ?? undefined,
      },
    };
  } catch (err) {
    logger.warn("auction:travel-details-failed", { error: String(err) });
    return intent;
  }
}

// ── Phase B — real price anchors ─────────────────────────────────────────────

const ANCHOR_PARSE_SYSTEM = `You are extracting a published flight fare from web search results for ONE specific booking site.

Given page content from that site and the traveller's requirements, find the most relevant published fare.

Return JSON:
{
  "found": true/false,
  "publishedPrice": 245.0,           // total price in SGD as a decimal — null if not determinable
  "itemSummary": "SIN→KUL direct, 1 adult, economy, 11 Jun",
  "sourceUrl": "the most specific URL the price came from"
}

Rules:
- Only report a price you can actually see in the content (exact, or a clearly stated 'from SGD X' fare). Do NOT invent or estimate one.
- Convert obviously non-SGD prices to SGD only when the currency and amount are explicit; otherwise treat as not found.
- If nothing usable, return {"found": false}.`;

// What is actually being procured — composed from the tender's own travel
// details so governance INTENT_MATCH audits the tender spec, not whatever
// route-page phrasing the fare was scraped from.
function tenderItemSummary(intent: UserIntent): string | null {
  const t = intent.travel;
  if (!t?.destination) return null;
  const date = t.departureDate ? `, ${t.departureDate}${relativeDayLabel(t.departureDate)}` : "";
  return `${t.origin ?? "Singapore"}→${t.destination}${t.directOnly ? " direct" : ""}, ${t.passengers ?? 1} adult, ${t.cabin ?? "economy"}${date}`;
}

// "2026-06-11" alone reads as an arbitrary future date to the governance LLM,
// which has no notion of today — annotate it so "tomorrow" intents audit cleanly.
function relativeDayLabel(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  if (isNaN(target.getTime())) return "";
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return " (today)";
  if (diffDays === 1) return " (tomorrow)";
  return "";
}

async function discoverAnchorForVendor(
  profile: VendorProfile,
  intent: UserIntent,
  attempt = 1
): Promise<VendorAnchor | null> {
  const t = intent.travel;
  const route = t?.destination
    ? `${t.origin ?? "Singapore"} to ${t.destination}`
    : intent.raw;
  const date = t?.departureDate ? ` on ${t.departureDate}` : "";
  const direct = t?.directOnly ? " direct non-stop" : "";
  const query =
    attempt === 1
      ? `${profile.name} flight price ${route}${date}${direct} ${t?.cabin ?? "economy"} fare SGD`
      : `cheap flights ${route} ticket price book online SGD`;

  try {
    const results = await exaSearchAndContents(query, 4, {
      includeDomains: profile.domains,
      livecrawl: "fallback",
    });

    if (!results.results?.length) {
      return attempt === 1 ? discoverAnchorForVendor(profile, intent, 2) : null;
    }

    const content = results.results
      .map((r, i) => `[${i + 1}] ${r.title ?? ""}\nURL: ${r.url}\n${(r.highlights ?? []).join(" … ")}\n${(r.text ?? "").slice(0, 900)}`)
      .join("\n\n---\n\n");

    const parsed = await llmCallJSON<{
      found?: boolean;
      publishedPrice?: number | null;
      itemSummary?: string;
      sourceUrl?: string;
    }>({
      system: ANCHOR_PARSE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Booking site: ${profile.name}\nTraveller wants: ${intent.raw}\n\nSearch results:\n\n${content}`,
        },
      ],
      maxTokens: 400,
    });

    if (!parsed.found || !parsed.publishedPrice || parsed.publishedPrice <= 0) {
      return attempt === 1 ? discoverAnchorForVendor(profile, intent, 2) : null;
    }

    return {
      vendorId: uuidv4(),
      vendor: profile.name,
      publishedPrice: parsed.publishedPrice,
      currency: "SGD",
      itemSummary: tenderItemSummary(intent) ?? parsed.itemSummary ?? route,
      sourceUrl: parsed.sourceUrl ?? results.results[0].url,
    };
  } catch (err) {
    logger.warn("auction:anchor-failed", { vendor: profile.name, attempt, error: String(err) });
    return attempt === 1 ? discoverAnchorForVendor(profile, intent, 2) : null;
  }
}

// ── Phase C — bidding rounds ─────────────────────────────────────────────────

function bidderSystemPrompt(
  profile: VendorProfile,
  anchor: VendorAnchor,
  tender: TenderBroadcast,
  round: number,
  board: VendorBid[] | null
): string {
  const intent = tender.intent;
  const constraints = intent.constraints?.length ? intent.constraints.join(", ") : "none stated";
  const boardBlock =
    round > 1 && board
      ? `FINAL ROUND — best and final offer. COMPETITOR BOARD AFTER ROUND ${round - 1}:\n${JSON.stringify(
          board.map((b) => ({
            vendor: b.vendor,
            price: b.price,
            valueAdds: b.valueAdds,
            canImprove: b.canImprove,
          })),
          null,
          2
        )}\nDecide whether to counter-bid, add value, or hold — in character.`
      : "This is a SEALED first round — you cannot see competitor offers. Put forward a strong opening bid.";

  return `You are the bidding agent for ${profile.name}, competing in a procurement tender.
${profile.character}

YOUR BIDDING POLICY: ${profile.biddingPolicy}

TENDER: "${intent.raw}"
Buyer budget: ${tender.budget ? `SGD ${tender.budget}` : "not stated"} | Constraints: ${constraints}

YOUR PUBLISHED PRICE (real, found live at ${anchor.sourceUrl}): SGD ${anchor.publishedPrice} — ${anchor.itemSummary}

${boardBlock}

Anchor every claim to your published price. Never invent products or prices disconnected from it.
Respond with JSON only:
{ "price": <number, SGD>, "valueAdds": ["..."], "pitch": "<persuasive, in character, under 80 words>", "canImprove": <boolean>, "conditions": "<optional string — only if your offer has a condition like immediate commitment>" }`;
}

async function getBid(
  profile: VendorProfile,
  anchor: VendorAnchor,
  tender: TenderBroadcast,
  round: number,
  board: VendorBid[] | null
): Promise<VendorBid> {
  const raw = await llmCallJSON<{
    price?: number;
    valueAdds?: string[];
    pitch?: string;
    canImprove?: boolean;
    conditions?: string | null;
  }>({
    system: bidderSystemPrompt(profile, anchor, tender, round, board),
    messages: [{ role: "user", content: "Submit your bid for this round." }],
    maxTokens: 500,
  });

  // Structural validation only — bidding policies are prompt-only by design.
  if (typeof raw.price !== "number" || raw.price <= 0 || !raw.pitch?.trim()) {
    throw new Error(`bidder ${profile.slug} returned an invalid bid shape`);
  }

  return {
    vendorId: anchor.vendorId,
    vendor: profile.name,
    round,
    price: Math.round(raw.price * 100) / 100,
    valueAdds: Array.isArray(raw.valueAdds) ? raw.valueAdds.filter((v) => typeof v === "string") : [],
    pitch: raw.pitch.trim(),
    canImprove: raw.canImprove ?? false,
    conditions: raw.conditions?.trim() || undefined,
  };
}

async function runBiddingRound(
  bidders: Array<{ profile: VendorProfile; anchor: VendorAnchor }>,
  tender: TenderBroadcast,
  round: number,
  previousBids: VendorBid[] | null,
  emit: (type: AgentEvent["type"], agent: string, data?: unknown) => Promise<void>
): Promise<AuctionRound> {
  const kind = round === 1 ? "sealed" : "final";
  await emit("auction:round_start", "auction", { round, kind });
  logger.section(`AUCTION ROUND ${round} (${kind.toUpperCase()})`);

  const settled = await Promise.allSettled(
    bidders.map(async ({ profile, anchor }) => {
      await emit("agent:start", `bidder_${profile.slug}`, { round, vendor: profile.name });
      const bid = await getBid(profile, anchor, tender, round, previousBids);
      await emit("auction:bid", `bidder_${profile.slug}`, { ...bid });
      return bid;
    })
  );

  const bids: VendorBid[] = [];
  settled.forEach((s, i) => {
    const { profile, anchor } = bidders[i];
    if (s.status === "fulfilled") {
      bids.push(s.value);
      return;
    }
    // A failed bidder carries its previous bid forward rather than killing the round.
    const prior = previousBids?.find((b) => b.vendorId === anchor.vendorId);
    logger.warn("auction:bidder-failed", { vendor: profile.name, round, error: String(s.reason) });
    if (prior) {
      const carried: VendorBid = { ...prior, round, carriedForward: true };
      bids.push(carried);
      void emit("auction:bid", `bidder_${profile.slug}`, { ...carried });
    }
  });

  if (bids.length === 0) {
    throw new Error(`Auction round ${round}: every bidder failed`);
  }

  logger.info("auction:round-complete", {
    round,
    bids: bids.map((b) => ({
      vendor: b.vendor,
      price: `SGD ${b.price}`,
      valueAdds: b.valueAdds,
      canImprove: b.canImprove,
      carriedForward: b.carriedForward ?? false,
    })),
  });

  await emit("auction:round_complete", "auction", {
    round,
    board: bids.map((b) => ({ vendor: b.vendor, price: b.price, valueAdds: b.valueAdds, canImprove: b.canImprove })),
  });

  return { round, kind, bids };
}

// ── Phase D — judge ──────────────────────────────────────────────────────────

const JUDGE_SYSTEM = `You are the buyer's evaluation agent judging final bids in a procurement auction.

Score each bid 0-100 using these weights:
- 30% price vs budget (cheaper relative to budget scores higher; over budget is heavily penalised)
- 35% fit to the tender's requirements and constraints (e.g. direct flight, comfort)
- 20% value-adds (free cancellation, seat selection, bundles — only if relevant to the buyer)
- 15% credibility (is the offer plausible relative to the vendor's published price? penalise non-credible discounts)

Conditions like "must commit immediately" are acceptable but slightly reduce credibility if restrictive.

Return JSON:
{
  "ranking": [
    { "vendor": "...", "item": "...", "price": 199.0, "score": 87, "withinBudget": true, "reasoning": "one sharp sentence" }
  ],
  "verdict": "2-3 sentences naming the winner and why, referencing the bidding war",
  "winnerVendor": "exact vendor name of the top-ranked bid"
}
Rank EVERY bid. Scores must reflect the weights honestly.`;

async function judgeAuction(
  tender: TenderBroadcast,
  finalBids: VendorBid[],
  anchors: VendorAnchor[]
): Promise<AuctionEvaluation> {
  const anchorByVendor = new Map(anchors.map((a) => [a.vendorId, a]));

  const bidLines = finalBids.map((b) => ({
    vendor: b.vendor,
    item: anchorByVendor.get(b.vendorId)?.itemSummary ?? "",
    finalPrice: b.price,
    publishedPrice: anchorByVendor.get(b.vendorId)?.publishedPrice,
    valueAdds: b.valueAdds,
    pitch: b.pitch,
    conditions: b.conditions ?? null,
  }));

  const parsed = await llmCallJSON<{
    ranking?: Array<{
      vendor?: string;
      item?: string;
      price?: number;
      score?: number;
      withinBudget?: boolean;
      reasoning?: string;
    }>;
    verdict?: string;
    winnerVendor?: string;
  }>({
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Tender: "${tender.intent.raw}"\nBudget: ${tender.budget ? `SGD ${tender.budget}` : "not stated"}\nConstraints: ${tender.intent.constraints?.join(", ") || "none"}\n\nFinal bids:\n${JSON.stringify(bidLines, null, 2)}`,
      },
    ],
    maxTokens: 1500,
  });

  if (!parsed.ranking?.length) {
    throw new Error("Auction judge returned no ranking");
  }

  const ranking: RankingEntry[] = parsed.ranking.map((r) => ({
    vendor: r.vendor ?? "unknown",
    item: r.item ?? "",
    price: r.price ?? 0,
    score: Math.max(0, Math.min(100, r.score ?? 0)),
    withinBudget: r.withinBudget ?? (tender.budget ? (r.price ?? 0) <= tender.budget : true),
    reasoning: r.reasoning ?? "",
  }));

  // Deterministic winner resolution with in-code tie-break: among top-score
  // entries, the lowest in-budget price wins.
  const topScore = Math.max(...ranking.map((r) => r.score));
  const top = ranking
    .filter((r) => r.score === topScore)
    .sort((a, b) => {
      if (a.withinBudget !== b.withinBudget) return a.withinBudget ? -1 : 1;
      return a.price - b.price;
    })[0];

  const winnerName = (parsed.winnerVendor && ranking.some((r) => r.vendor === parsed.winnerVendor) && topScore === ranking.find((r) => r.vendor === parsed.winnerVendor)!.score)
    ? parsed.winnerVendor
    : top.vendor;

  const winnerBid = finalBids.find(
    (b) => b.vendor.trim().toLowerCase() === winnerName.trim().toLowerCase()
  ) ?? finalBids.find((b) => b.vendor.trim().toLowerCase() === top.vendor.trim().toLowerCase());

  if (!winnerBid) {
    throw new Error(`Auction judge winner "${winnerName}" does not match any bid`);
  }

  return {
    ranking,
    verdict: parsed.verdict ?? `Winner: ${winnerBid.vendor} at SGD ${winnerBid.price}.`,
    winnerVendorId: winnerBid.vendorId,
  };
}

// ── Winner normalization — keeps governance/Stripe/DB untouched ──────────────

function toWinnerPaymentIntent(
  winnerBid: VendorBid,
  anchor: VendorAnchor,
  evaluation: AuctionEvaluation,
  rounds: AuctionRound[]
): WinnerPaymentIntent {
  const winnerRank = evaluation.ranking.find(
    (r) => r.vendor.trim().toLowerCase() === winnerBid.vendor.trim().toLowerCase()
  );

  return {
    id: anchor.vendorId,
    vendor: winnerBid.vendor,
    item: anchor.itemSummary,
    description: winnerBid.pitch,
    price: winnerBid.price,
    currency: anchor.currency,
    link: anchor.sourceUrl,
    order_url: anchor.sourceUrl,
    why_pick: winnerRank?.reasoning,
    metadata: {
      mode: "auction",
      publishedPrice: String(anchor.publishedPrice),
      ...(winnerBid.conditions ? { conditions: winnerBid.conditions } : {}),
    },
    procurementRationale: evaluation.verdict,
    score: winnerRank?.score ?? 0,
    withinBudget: winnerRank?.withinBudget ?? true,
    rankedAlternatives: [],
    conversation: rounds.map((r) => ({
      round: r.round === 1 ? "Round 1 — sealed bids" : "Round 2 — best & final",
      entries: r.bids.map((b) => ({
        speaker: b.vendor,
        message: `SGD ${b.price}${b.valueAdds.length ? ` + ${b.valueAdds.join(", ")}` : ""}${b.conditions ? ` (${b.conditions})` : ""} — ${b.pitch}`,
      })),
    })),
    ranking: evaluation.ranking,
  };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function runAuctionPipeline(
  rawInput: string,
  txId: string,
  onEvent?: OnEvent,
  anchorsOverride?: { anchors: VendorAnchor[]; profiles: VendorProfile[]; category: "flight" | "generic" }
): Promise<{ intent: UserIntent; outcome: AuctionOutcome }> {
  logger.section("AGENTBID AUCTION PIPELINE — START");

  const emit = async (type: AgentEvent["type"], agent: string, data?: unknown) => {
    try {
      await onEvent?.({ type, agent, data, timestamp: new Date().toISOString() });
    } catch {
      /* telemetry must never break the pipeline */
    }
  };

  await emit("agent:start", "auction");

  // ── Phase A — intent + tender ──────────────────────────────────────────────
  let intent = await parseIntent(rawInput);
  const flight = anchorsOverride ? anchorsOverride.category === "flight" : isFlightIntent(intent);
  if (flight && !anchorsOverride) intent = await extractTravelDetails(intent);

  const tender: TenderBroadcast = {
    id: txId,
    intent,
    budget: intent.budget,
    currency: intent.currency ?? "SGD",
    category: flight ? "flight" : "generic",
    maxRounds: MAX_ROUNDS,
  };

  // ── Phase B — resolve bidders + real price anchors ─────────────────────────
  logger.section("PHASE B — TENDER DISCOVERY (REAL PRICE ANCHORS)");
  const skipped: Array<{ vendor: string; reason: string }> = [];
  let bidders: Array<{ profile: VendorProfile; anchor: VendorAnchor }> = [];

  if (anchorsOverride) {
    bidders = anchorsOverride.anchors.map((anchor) => {
      const profile = anchorsOverride.profiles.find((p) => p.name === anchor.vendor);
      if (!profile) throw new Error(`anchorsOverride: no profile for ${anchor.vendor}`);
      return { profile, anchor };
    });
  } else if (flight) {
    const results = await Promise.all(
      FLIGHT_VENDORS.map(async (profile) => ({
        profile,
        anchor: await discoverAnchorForVendor(profile, intent),
      }))
    );
    for (const r of results) {
      if (r.anchor) {
        bidders.push({ profile: r.profile, anchor: r.anchor });
      } else {
        skipped.push({ vendor: r.profile.name, reason: "no live fare found" });
        await emit("bidder:skipped", "tender", { vendor: r.profile.name, reason: "no live fare found" });
      }
    }
  } else {
    const options = await runDiscovery(intent);
    const generic = await buildGenericBidders(options);
    bidders = generic.map(({ profile, option }) => ({
      profile,
      anchor: {
        vendorId: option.id,
        vendor: option.vendor,
        publishedPrice: option.price,
        currency: option.currency ?? "SGD",
        itemSummary: option.item,
        sourceUrl: option.order_url,
      },
    }));
  }

  if (bidders.length < 2) {
    throw new Error(
      `Auction needs at least 2 vendors with real discovered prices — found ${bidders.length}` +
        (skipped.length ? ` (skipped: ${skipped.map((s) => s.vendor).join(", ")})` : "")
    );
  }

  await emit("agent:complete", "tender", {
    category: tender.category,
    vendors: bidders.map((b) => b.profile.name),
    count: bidders.length,
    skipped: skipped.map((s) => s.vendor),
  });

  for (const b of bidders) {
    await emit("auction:anchor", "tender", {
      vendor: b.anchor.vendor,
      publishedPrice: b.anchor.publishedPrice,
      itemSummary: b.anchor.itemSummary,
      sourceUrl: b.anchor.sourceUrl,
    });
  }

  logger.info("auction:bidders-resolved", {
    category: tender.category,
    bidders: bidders.map((b) => ({
      vendor: b.profile.name,
      source: b.profile.source,
      publishedPrice: `SGD ${b.anchor.publishedPrice}`,
    })),
    skipped: skipped.map((s) => s.vendor),
  });

  // ── Phase C — bidding rounds ───────────────────────────────────────────────
  const rounds: AuctionRound[] = [];
  let board: VendorBid[] | null = null;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const result = await runBiddingRound(bidders, tender, round, board, emit);
    rounds.push(result);
    board = result.bids;
  }

  // ── Phase D — judge ────────────────────────────────────────────────────────
  logger.section("PHASE D — AUCTION JUDGE");
  await emit("agent:start", "auction_judge");
  const finalBids = rounds[rounds.length - 1].bids;
  const anchors = bidders.map((b) => b.anchor);
  const evaluation = await judgeAuction(tender, finalBids, anchors);

  const winnerBid = finalBids.find((b) => b.vendorId === evaluation.winnerVendorId)!;
  const winnerAnchor = anchors.find((a) => a.vendorId === evaluation.winnerVendorId)!;
  const winner = toWinnerPaymentIntent(winnerBid, winnerAnchor, evaluation, rounds);

  await emit("agent:complete", "auction_judge", {
    verdict: evaluation.verdict,
    winner: winnerBid.vendor,
    ranking: evaluation.ranking,
  });

  logger.info("auction:winner", {
    vendor: winner.vendor,
    item: winner.item,
    finalPrice: `SGD ${winner.price}`,
    publishedPrice: `SGD ${winnerAnchor.publishedPrice}`,
    score: winner.score,
  });

  const outcome: AuctionOutcome = {
    tender,
    anchors,
    skipped,
    bidders: bidders.map((b) => ({ slug: b.profile.slug, name: b.profile.name, source: b.profile.source })),
    rounds,
    evaluation,
    winner,
  };

  return { intent, outcome };
}
