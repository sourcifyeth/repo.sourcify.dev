import type { NextConfig } from "next";

// These redirects are needed because we are replacing the UI under the same domain (repo.sourcify.dev). Our old repo was https://github.com/sourcifyeth/h5ai-nginx and it did the static file redirects inside its own nginx config.
// We tried doing the redirects via GCP load balancer but it's essentially not possible to tell the LB to redirect anyting ending with a file extension to somewhere.
// Instead we do the redirects here in Next.js.

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    // Get the server URL from environment variable, with a fallback
    const serverUrl = process.env.SOURCIFY_SERVER_URL;
    if (!serverUrl) {
      throw new Error("SOURCIFY_SERVER_URL is not set");
    }

    return [
      {
        // Generic rule for any file with an extension
        source: "/contracts/:matchType*/:chainId/:address/sources/:filePath*.:ext",
        destination: `${serverUrl}/repository/contracts/:matchType*/:chainId/:address/sources/:filePath*.:ext`,
        permanent: true,
      },
      {
        // Rule for files at the root level (like metadata.json)
        source: "/contracts/:matchType*/:chainId/:address/:file.:ext",
        destination: `${serverUrl}/repository/contracts/:matchType*/:chainId/:address/:file.:ext`,
        permanent: true,
      },
      {
        // Fallback rule: redirect any other paths under /contracts/(full_match|partial_match)/:chainId/:address/ to /:chainId/:address/
        // From: https://<repo-url>/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/
        // Or From: https://<repo-url>/contracts/full_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/sources/a/very/long/path/  (no file extension)
        // To: https://<repo-url>/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/
        source: "/contracts/:matchType(full_match|partial_match)/:chainId/:address/:path*",
        destination: "/:chainId/:address/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
