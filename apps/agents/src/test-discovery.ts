import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../.env` });

import { runProcurement } from "./agents/procurement";
import type { PaymentIntent } from "./agents/types";

const QUERY = "find me 5 options to order the best burger under $30 near Marina Bay Sands";

const W = 62;
const line = "─".repeat(W);
const dline = "═".repeat(W);

function box(label: string, value: string | number | undefined, missing = false) {
  const v = value !== undefined && value !== "" ? String(value) : null;
  const prefix = missing && !v ? "  ⚠ MISSING  " : "             ";
  const display = v ? (typeof value === "number" ? v : v.slice(0, W - 15)) : "(missing)";
  console.log(`  ${label.padEnd(13)} ${missing && !v ? "❌" : "  "} ${display}`);
}

function validateOption(opt: PaymentIntent): string[] {
  const errors: string[] = [];
  if (!opt.vendor || opt.vendor.trim() === "") errors.push("vendor");
  if (!opt.item || opt.item.trim() === "") errors.push("item");
  if (!opt.price || opt.price <= 0 || typeof opt.price !== "number") errors.push("price");
  if (!opt.order_url || opt.order_url.trim() === "") errors.push("order_url");
  return errors;
}

async function main() {
  console.log("\n" + dline);
  console.log("  AgentBid — Discovery Phase Test Harness");
  console.log(dline);
  console.log(`  Query: "${QUERY}"`);
  console.log(dline + "\n");

  let options: PaymentIntent[];

  try {
    options = await runProcurement(QUERY);
  } catch (err) {
    console.error("\n  FATAL ERROR:", err);
    process.exit(1);
  }

  if (options.length === 0) {
    console.error("  VALIDATION FAILED — pipeline returned 0 options");
    process.exit(1);
  }

  console.log("\n\x1b[1m🔍 RAW EXA OUTPUT\x1b[0m\n");
  console.log(JSON.stringify(options, null, 2));

  let totalErrors = 0;

  options.forEach((opt, i) => {
    const errors = validateOption(opt);
    totalErrors += errors.length;

    console.log(line);
    console.log(`  Option ${i + 1} of ${options.length}${errors.length > 0 ? "  ⚠ HAS ERRORS" : "  ✓ VALID"}`);
    console.log(line);

    const hasMissing = (field: keyof PaymentIntent) =>
      !opt[field] || opt[field] === "";

    console.log(`  vendor        ${hasMissing("vendor") ? "❌" : "  "} ${opt.vendor || "(missing)"}`);
    console.log(`  item          ${hasMissing("item") ? "❌" : "  "} ${opt.item || "(missing)"}`);
    console.log(
      `  price         ${!opt.price || opt.price <= 0 ? "❌" : "  "} SGD ${opt.price?.toFixed(2) ?? "(missing)"}`
    );
    console.log(
      `  order_url     ${hasMissing("order_url") ? "❌" : "  "} ${(opt.order_url || "(missing)").slice(0, W - 18)}`
    );
    console.log(
      `  description      ${opt.description ? opt.description.slice(0, W - 20) : "(none)"}`
    );
    console.log(
      `  why_pick         ${opt.why_pick ? opt.why_pick.slice(0, W - 20) : "(none)"}`
    );

    if (errors.length > 0) {
      console.log(`\n  Missing required fields: ${errors.join(", ")}`);
    }
    console.log();
  });

  console.log(dline);

  if (totalErrors > 0) {
    console.log(`  VALIDATION FAILED — ${totalErrors} missing required field(s) across ${options.length} option(s)`);
    console.log(dline + "\n");
    process.exit(1);
  } else {
    console.log(`  VALIDATION PASSED — ${options.length} options returned, all required fields present`);
    console.log(dline + "\n");
  }
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
