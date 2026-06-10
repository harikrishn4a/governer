"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function log(level, message, meta = {}) {
    const entry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...meta,
    };
    const out = level === "error" ? console.error : console.log;
    out(JSON.stringify(entry));
}
// Prints a clear visual section banner — plain text, not JSON, so it stands out in the terminal.
function section(title) {
    const line = "━".repeat(64);
    console.log(`\n${line}`);
    console.log(`  ▶  ${title}`);
    console.log(`${line}`);
}
exports.logger = {
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    debug: (message, meta) => log("debug", message, meta),
    section,
};
