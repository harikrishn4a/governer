import type { NextConfig } from "next";
import path from "path";
import { config as dotenvConfig } from "dotenv";

// Load the root .env (governer/.env) so all vars are available to API routes
// and NEXT_PUBLIC_* vars are baked at build/dev-server startup.
dotenvConfig({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  experimental: {},
};

export default nextConfig;
