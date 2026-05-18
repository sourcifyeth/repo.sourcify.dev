import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is needed for Docker but conflicts with @netlify/plugin-nextjs
  output: process.env.NETLIFY ? undefined : "standalone",
  // /api/growthepie-contracts fans out ~160 fetches to the Sourcify server at build time.
  // The default 60s per-page timeout is too tight on slower build networks (e.g. Cloudflare).
  staticPageGenerationTimeout: 300,
};

export default nextConfig;
