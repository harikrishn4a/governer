type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const out = level === "error" ? console.error : console.log;
  out(JSON.stringify(entry));
}

// Prints a clear visual section banner — plain text, not JSON, so it stands out in the terminal.
function section(title: string) {
  const line = "━".repeat(64);
  console.log(`\n${line}`);
  console.log(`  ▶  ${title}`);
  console.log(`${line}`);
}

export const logger = {
  info:    (message: string, meta?: Record<string, unknown>) => log("info",  message, meta),
  warn:    (message: string, meta?: Record<string, unknown>) => log("warn",  message, meta),
  error:   (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  debug:   (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  section,
};
