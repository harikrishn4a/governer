"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmitter = createEmitter;
const logger_1 = require("./logger");
// Where the web app's SSE ingest endpoint lives.
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
/**
 * Returns an emit function bound to a transaction id. Each call POSTs the event
 * to the web app's /api/stream/ingest endpoint, which fans it out over SSE.
 *
 * Failures are logged and swallowed — telemetry must never break the pipeline.
 * Calls are awaited so events arrive in emission order.
 */
function createEmitter(txId) {
    return async (event) => {
        try {
            await fetch(`${WEB_URL}/api/stream/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ txId, ...event }),
                signal: AbortSignal.timeout(5000),
            });
        }
        catch (err) {
            logger_1.logger.warn("event-bus:ingest-failed", {
                txId,
                type: event.type,
                agent: event.agent,
                error: String(err),
            });
        }
    };
}
