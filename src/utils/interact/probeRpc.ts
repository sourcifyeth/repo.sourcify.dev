/**
 * Server side: checks which public RPC endpoints of a chain work from a browser. Runs in the API route, so
 * the user's browser contacts no provider before the user reads. An endpoint passes if it answers
 * eth_chainId with the right chain id and allows a browser request from another site (CORS).
 */
import { type ChainlistEntry, usableRpcs } from "./chainRpcs";

const PROBE_TIMEOUT_MS = 2500;
/** How many endpoints to check per round, in list order. A second round runs if fewer than two pass. */
const ROUND_SIZE = 8;
const HEALTH_MAX_AGE_MS = 60 * 60 * 1000;
/** The origin that the check sends: any other site works the same for CORS. */
const PROBE_ORIGIN = "https://repo.sourcify.dev";

/**
 * True if the host is this machine or a private network: a loopback, private, link-local or unique-local
 * IP address (IPv4 or IPv6), or "localhost". The URLs come from a third-party list, so the server never
 * sends a request there. Host names that resolve to such addresses are not caught here; the browser
 * makes the real reads anyway.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (host.includes(":")) {
    // IPv4-mapped (::ffff:10.0.0.1 or ::ffff:a00:1) and the unspecified and loopback addresses
    if (host === "::" || host === "::1") return true;
    const mapped = /^::ffff:(.+)$/.exec(host);
    if (mapped) {
      const tail = mapped[1];
      if (tail.includes(".")) return isPrivateHost(tail);
      const [high, low] = tail.split(":").map((part) => Number.parseInt(part || "0", 16));
      return isPrivateHost(`${high >> 8}.${high & 255}.${(low ?? 0) >> 8}.${(low ?? 0) & 255}`);
    }
    const first = Number.parseInt(host.split(":")[0] || "0", 16);
    // fc00::/7 unique local, fe80::/10 link-local
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
  }
  return false;
}

export async function probeRpc(url: string, chainId: number, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    if (isPrivateHost(new URL(url).hostname)) return false;
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: PROBE_ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
      // A redirect could lead the server to another host; an endpoint that redirects counts as down
      redirect: "error",
    });
    if (!response.ok) return false;
    const allowed = response.headers.get("access-control-allow-origin");
    if (allowed !== "*" && allowed !== PROBE_ORIGIN) return false;
    const body = (await response.json()) as { result?: string };
    return typeof body.result === "string" && Number.parseInt(body.result, 16) === chainId;
  } catch {
    return false;
  }
}

const cache = new Map<number, { at: number; health: Map<string, boolean> }>();
const running = new Map<number, Promise<Map<string, boolean>>>();

/**
 * The health of the first endpoints of a chain: checks rounds of endpoints until two from different
 * providers pass, or until the list ends. Kept for an hour per chain in the memory of the server.
 */
export function chainHealth(
  chainId: number,
  entry: ChainlistEntry,
  fetchImpl: typeof fetch = fetch,
  now = Date.now()
): Promise<Map<string, boolean>> {
  const hit = cache.get(chainId);
  if (hit && now - hit.at < HEALTH_MAX_AGE_MS) return Promise.resolve(hit.health);
  const pending = running.get(chainId);
  if (pending) return pending;
  const job = (async () => {
    const rpcs = usableRpcs(entry);
    const health = new Map<string, boolean>();
    const goodProviders = new Set<string>();
    for (let start = 0; start < rpcs.length && goodProviders.size < 2; start += ROUND_SIZE) {
      const round = rpcs.slice(start, start + ROUND_SIZE);
      const results = await Promise.all(round.map((rpc) => probeRpc(rpc.url, chainId, fetchImpl)));
      round.forEach((rpc, i) => {
        health.set(rpc.url, results[i]);
        if (results[i]) goodProviders.add(rpc.provider);
      });
    }
    cache.set(chainId, { at: Date.now(), health });
    return health;
  })().finally(() => running.delete(chainId));
  running.set(chainId, job);
  return job;
}

/** For tests */
export function clearHealthCache() {
  cache.clear();
  running.clear();
}
