import { NextResponse } from "next/server";
import { type ChainlistEntry, chainRpcs, indexChainlist } from "@/utils/interact/chainRpcs";
import { chainHealth } from "@/utils/interact/probeRpc";

/**
 * The public RPC endpoints of one chain, from Chainlist. The read calls of the "Read/Write Contract"
 * tab go from the browser directly to these endpoints; this route only gives the list.
 *
 * The same answer has the endpoints for a wallet that does not know the chain (wallet_addEthereumChain):
 * only those that passed the server's check (see walletRpcsOf).
 *
 * The file is large (about 2.4 MB). The Next.js data cache does not store items over 2 MB, so the route
 * keeps the parsed list in the memory of the server instance for a day. If Chainlist is down, it keeps
 * using the last good copy. Before it answers, it checks the first endpoints of the chain
 * (probeRpc.ts, cached for an hour). Each answer is small (about 2 kB) and a CDN may cache it for an hour.
 */
const CHAINLIST_URL = "https://chainlist.org/rpcs.json";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

/** The Chainlist list, indexed by chain id, kept in memory for a day; the last good copy if a download fails. */
function memoryList(url: string, label: string) {
  let cached: { index: Map<number, ChainlistEntry>; at: number } | null = null;
  let loading: Promise<Map<number, ChainlistEntry>> | null = null;
  return async function load(): Promise<Map<number, ChainlistEntry>> {
    if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.index;
    // One download at a time, even if many requests arrive together
    loading ??= (async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) throw new Error(`${label}: ${response.status}`);
        const index = indexChainlist(await response.json());
        if (index.size === 0) throw new Error(`${label}: empty list`);
        cached = { index, at: Date.now() };
        return index;
      } catch (error) {
        // Keep the last good copy; try again with the next request after a minute
        if (cached) {
          console.error(`${label} download failed, using the last good copy:`, error);
          cached.at = Date.now() - MAX_AGE_MS + 60_000;
          return cached.index;
        }
        throw error;
      } finally {
        loading = null;
      }
    })();
    return loading;
  };
}

const loadChainlist = memoryList(CHAINLIST_URL, "Chainlist");

export async function GET(_request: Request, { params }: { params: Promise<{ chainId: string }> }) {
  const { chainId } = await params;
  if (!/^\d{1,12}$/.test(chainId)) {
    return NextResponse.json({ error: "The chain id must be a number" }, { status: 400 });
  }
  const id = Number(chainId);
  try {
    const index = await loadChainlist();
    const entry = index.get(id);
    // The server checks the first endpoints, so that the defaults work (see utils/interact/probeRpc.ts)
    const health = entry ? await chainHealth(id, entry) : undefined;
    return NextResponse.json(chainRpcs(id, entry, health), {
      // An hour, as long as the health check: a dead endpoint must not stay a default for a day
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Chainlist is not available:", error);
    return NextResponse.json(
      { error: "The list of public RPC endpoints is not available. Try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
