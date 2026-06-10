"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: `${__dirname}/../../../.env` });
const procurement_1 = require("./agents/procurement");
const QUERY = "find me 5 options to order the best burger under $30 near Marina Bay Sands";
const W = 62;
const line = "─".repeat(W);
const dline = "═".repeat(W);
function box(label, value, missing = false) {
    const v = value !== undefined && value !== "" ? String(value) : null;
    const prefix = missing && !v ? "  ⚠ MISSING  " : "             ";
    const display = v ? (typeof value === "number" ? v : v.slice(0, W - 15)) : "(missing)";
    console.log(`  ${label.padEnd(13)} ${missing && !v ? "❌" : "  "} ${display}`);
}
function validateOption(opt) {
    const errors = [];
    if (!opt.vendor || opt.vendor.trim() === "")
        errors.push("vendor");
    if (!opt.item || opt.item.trim() === "")
        errors.push("item");
    if (!opt.price || opt.price <= 0 || typeof opt.price !== "number")
        errors.push("price");
    if (!opt.order_url || opt.order_url.trim() === "")
        errors.push("order_url");
    return errors;
}
async function main() {
    console.log("\n" + dline);
    console.log("  AgentBid — Discovery Phase Test Harness");
    console.log(dline);
    console.log(`  Query: "${QUERY}"`);
    console.log(dline + "\n");
    let options;
    try {
        options = await (0, procurement_1.runProcurement)(QUERY);
    }
    catch (err) {
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
        const hasMissing = (field) => !opt[field] || opt[field] === "";
        console.log(`  vendor        ${hasMissing("vendor") ? "❌" : "  "} ${opt.vendor || "(missing)"}`);
        console.log(`  item          ${hasMissing("item") ? "❌" : "  "} ${opt.item || "(missing)"}`);
        console.log(`  price         ${!opt.price || opt.price <= 0 ? "❌" : "  "} SGD ${opt.price?.toFixed(2) ?? "(missing)"}`);
        console.log(`  order_url     ${hasMissing("order_url") ? "❌" : "  "} ${(opt.order_url || "(missing)").slice(0, W - 18)}`);
        console.log(`  description      ${opt.description ? opt.description.slice(0, W - 20) : "(none)"}`);
        console.log(`  why_pick         ${opt.why_pick ? opt.why_pick.slice(0, W - 20) : "(none)"}`);
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
    }
    else {
        console.log(`  VALIDATION PASSED — ${options.length} options returned, all required fields present`);
        console.log(dline + "\n");
    }
}
main().catch((err) => {
    console.error("\nFatal:", err);
    process.exit(1);
});
