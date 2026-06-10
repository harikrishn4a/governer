import { llmCallJSON } from "../../lib/llm";
import { logger } from "../../lib/logger";
import { exaResearchVendor } from "../../tools/exa";
import type { PaymentIntent, VendorProfile } from "../types";

const PROFILE_SYSTEM = `You are building a negotiation profile for a vendor so an agent can bid on their behalf in a procurement auction.

Given web research about the vendor, infer how they actually compete commercially.

Return JSON:
{
  "character": "2-3 sentence persona paragraph for the bidding agent, written in second person ('You are ...'), grounded in what the research shows about the vendor",
  "biddingPolicy": "2-3 sentences describing how aggressively they discount, what they bundle or refuse to bundle, and what they pitch on (price, quality, speed, trust). Be specific to this vendor."
}`;

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "vendor";
}

// Build a researched bidder profile for one vendor — the generic-path analogue
// of the pre-built flight profiles. Research failures degrade to a neutral
// profile rather than dropping the bidder (their price anchor is still real).
export async function researchBidderProfile(vendor: string): Promise<VendorProfile> {
  const slug = slugify(vendor);
  try {
    const research = await exaResearchVendor(vendor);
    const profile = await llmCallJSON<{ character?: string; biddingPolicy?: string }>({
      system: PROFILE_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Vendor: ${vendor}\n\nWeb research:\n${research || "(no research results found)"}`,
        },
      ],
      maxTokens: 600,
    });

    if (profile.character && profile.biddingPolicy) {
      logger.info("auction:profile-researched", { vendor, slug });
      return {
        slug,
        name: vendor,
        domains: [],
        character: profile.character,
        biddingPolicy: profile.biddingPolicy,
        source: "researched",
      };
    }
  } catch (err) {
    logger.warn("auction:profile-research-failed", { vendor, error: String(err) });
  }

  return {
    slug,
    name: vendor,
    domains: [],
    character: `You are the bidding agent for ${vendor}. You represent the vendor faithfully and competitively in a procurement auction.`,
    biddingPolicy:
      "Offer modest discounts (up to about 10% below your published price) when competition is close, and pitch on the genuine strengths of your product.",
    source: "researched",
  };
}

// Generic path: the top distinct-vendor discovery options become bidders, each
// with an LLM-researched profile (profiles are researched in parallel).
export async function buildGenericBidders(
  options: PaymentIntent[],
  maxBidders = 5
): Promise<Array<{ profile: VendorProfile; option: PaymentIntent }>> {
  const byVendor = new Map<string, PaymentIntent>();
  for (const o of options) {
    const key = o.vendor.trim().toLowerCase();
    if (!byVendor.has(key)) byVendor.set(key, o);
  }
  const picks = [...byVendor.values()].slice(0, maxBidders);

  logger.info("auction:generic-bidders — researching profiles", {
    vendors: picks.map((p) => p.vendor),
  });

  const profiles = await Promise.all(picks.map((p) => researchBidderProfile(p.vendor)));
  return picks.map((option, i) => ({ profile: profiles[i], option }));
}
