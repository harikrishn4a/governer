import type { Config } from "tailwindcss";

// AgentBid color tokens. Values live as CSS variables in app/globals.css so the
// CSS and Tailwind layers share a single source of truth. Reference: DESIGN-SYSTEM.md.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Geometric display — large headings, vendor names, result numbers only.
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Realist grotesque — the app default for all UI/body text (small-size legible).
        sans: ["var(--font-ui)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Monospace — logs, IDs, code, prices.
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        // Semantic type scale (~1.25 modular). Display tokens carry their weight;
        // pair them with `font-display`. UI/mono tokens use the default family.
        overline: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em", fontWeight: "600" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
        label: ["0.8125rem", { lineHeight: "1.1rem", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.45" }],
        "body-lg": ["1rem", { lineHeight: "1.5" }],
        "display-md": ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        "display-lg": ["1.625rem", { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" }],
        "display-xl": ["2.125rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-2xl": ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "800" }],
        mono: ["0.8125rem", { lineHeight: "1.45" }],
        "mono-sm": ["0.75rem", { lineHeight: "1.4" }],
      },
      colors: {
        // Background hierarchy
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },

        // Text
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },

        // Accents
        accent: {
          blue: {
            DEFAULT: "var(--accent-blue)",
            hover: "var(--accent-blue-hover)",
            subtle: "var(--accent-blue-subtle)",
          },
          purple: {
            DEFAULT: "var(--accent-purple)",
            hover: "var(--accent-purple-hover)",
            subtle: "var(--accent-purple-subtle)",
          },
        },

        // Semantic — each: base / text / border / subtle bg
        accept: {
          DEFAULT: "var(--accept)",
          text: "var(--accept-text)",
          border: "var(--accept-border)",
          subtle: "var(--accept-subtle)",
        },
        block: {
          DEFAULT: "var(--block)",
          text: "var(--block-text)",
          border: "var(--block-border)",
          subtle: "var(--block-subtle)",
        },
        review: {
          DEFAULT: "var(--review)",
          text: "var(--review-text)",
          border: "var(--review-border)",
          subtle: "var(--review-subtle)",
        },

        // Node graph
        node: {
          broadcast: "var(--node-broadcast)",
          vendor: "var(--node-vendor)",
          contract: "var(--node-contract)",
          winner: "var(--node-winner)",
          loser: "var(--node-loser)",
        },
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },

      // Motion — see /MOTION.md. Durations/easings come from CSS vars (globals.css)
      // so timing is single-source; keyframes live here so Tailwind generates them.
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        "in-expo": "var(--ease-in-expo)",
        smooth: "var(--ease-in-out)",
      },
      transitionDuration: {
        micro: "var(--motion-micro)",
        standard: "var(--motion-standard)",
        complex: "var(--motion-complex)",
      },
      keyframes: {
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.06)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.15)" },
        },
        "glow-bright": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1.05)" },
          "50%": { opacity: "1", transform: "scale(1.25)" },
        },
        "ping-ring": {
          "0%": { opacity: "0.6", transform: "scale(0.8)" },
          "100%": { opacity: "0", transform: "scale(2.2)" },
        },
        "vendor-in": {
          from: { opacity: "0", transform: "scale(0.6)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "log-in": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "card-reveal": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "col-rise": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "hero-exit": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-16px)" },
        },
      },
      animation: {
        // Node graph — looping
        heartbeat: "heartbeat var(--pulse-broadcast) var(--ease-in-out) infinite",
        "heartbeat-fast": "heartbeat var(--pulse-active) var(--ease-in-out) infinite",
        glow: "glow var(--pulse-broadcast) var(--ease-in-out) infinite",
        "glow-fast": "glow-bright var(--pulse-active) var(--ease-in-out) infinite",
        "ping-ring": "ping-ring var(--pulse-broadcast) var(--ease-out-expo) infinite",
        // Entrances — run once, hold end state (`both`)
        "vendor-in": "vendor-in var(--motion-standard) var(--ease-out-expo) both",
        "log-in": "log-in var(--motion-log-line) var(--ease-out-expo) both",
        "card-reveal": "card-reveal var(--motion-result-card) var(--ease-out-expo) both",
        "col-rise": "col-rise var(--motion-complex) var(--ease-out-expo) both",
        "hero-exit": "hero-exit var(--motion-hero-exit) var(--ease-in-expo) both",
      },
    },
  },
  plugins: [],
};

export default config;
