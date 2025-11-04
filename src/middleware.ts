import { NextRequest, NextResponse } from "next/server";

// This middleware runs on every request and handles redirects dynamically
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the server URL from environment variable at runtime
  const serverUrl = process.env.SOURCIFY_SERVER_URL;
  if (!serverUrl) {
    throw new Error("SOURCIFY_SERVER_URL is not set");
  }

  const sessionCookie = request.cookies.get(
    `${
      process.env.NODE_ENV === "production" ? "__Secure-" : ""
    }better-auth.session_token`
  );
  const isLogged = !!sessionCookie;
  if (!isLogged) {
    return NextResponse.redirect(
      `${
        process.env.NODE_ENV === "production"
          ? "https://evm.walnut.dev"
          : "http://evm.walnut.local"
      }/login`
    );
  }

  // Check if the path matches a file in the contracts directory
  // From: https://<repo-url>/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/sources/a/very/long/path/MyContract.sol
  // OR From: https://<repo-url>/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/metadata.json
  //
  // To: https://<sourcify-server-url>/repository/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/sources/a/very/long/path/MyContract.sol
  // OR To: https://<sourcify-server-url>/repository/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/metadata.json
  const staticFilePattern =
    /^\/contracts\/(.+?)\/(.+?)\/(.+?)\/(.+?)\.([a-zA-Z0-9]+)$/;
  const staticFileMatch = pathname.match(staticFilePattern);

  if (staticFileMatch) {
    const [, matchType, chainId, address, filePath, ext] = staticFileMatch;
    const destination = `${serverUrl}/repository/contracts/${matchType}/${chainId}/${address}/${filePath}.${ext}`;
    const response = NextResponse.redirect(new URL(destination));

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  }

  // Fallback rule: redirect any other paths under /contracts/(full_match|partial_match)/:chainId/:address/ to /:chainId/:address/
  // From: https://<repo-url>/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/
  // Or From: https://<repo-url>/contracts/partial_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984 (no trailing slash)
  // Or From: https://<repo-url>/contracts/full_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/sources/a/very/long/path/  (no file extension)
  // To: https://<repo-url>/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/
  const fallbackPattern =
    /^\/contracts\/(full_match|partial_match)\/([^\/]+)\/([^\/]+)(\/.*)?$/;
  const fallbackMatch = pathname.match(fallbackPattern);

  if (fallbackMatch) {
    const [, , chainId, address] = fallbackMatch;
    const destination = `/${chainId}/${address}/`;
    const response = NextResponse.redirect(new URL(destination, request.url));

    // Add CORS headers
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    return response;
  }

  // Continue to the application for all other requests
  return NextResponse.next();
}

// Configure the middleware to run only on specific paths
// export const config = {
//   matcher: [
//     // Match all paths under /contracts
//     "/contracts/:path*",
//   ],
// };
