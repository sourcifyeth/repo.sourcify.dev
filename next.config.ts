import type { NextConfig } from "next";

// Fail the build (and `next dev`) early when the Sourcify server URLs are
// missing. Without this a missing variable only surfaces at request time as an
// error page on every contract page, and the pre-rendered growthepie route
// silently marks every top contract as unverified.
for (const name of ["SOURCIFY_SERVER_URL", "SOURCIFY_SERVER_INTERNAL_URL"]) {
  if (!process.env[name]) {
    throw new Error(`${name} is not set. See .env.example`);
  }
}

const nextConfig: NextConfig = {
  // "standalone" is needed for Docker but conflicts with @netlify/plugin-nextjs
  output: process.env.NETLIFY ? undefined : "standalone",
};

export default nextConfig;
