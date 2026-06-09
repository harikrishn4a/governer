import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accept: { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
        block:  { bg: "#fee2e2", border: "#dc2626", text: "#b91c1c" },
        review: { bg: "#fef3c7", border: "#d97706", text: "#92400e" },
      },
    },
  },
  plugins: [],
};

export default config;
