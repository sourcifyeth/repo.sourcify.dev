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

export async function probeRpc(url: string, chainId: number, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: PROBE_ORIGIN },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
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
