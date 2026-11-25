/**
 * Public RPC endpoints of a chain, from the Chainlist list (https://chainlist.org/rpcs.json).
 * Pure functions: the API route (src/app/api/chain-rpcs) loads the list, and the tests use small samples.
 */

/** How much a provider tracks its users, as Chainlist labels it. "unknown": Chainlist gives no label. */
export type Tracking = "none" | "limited" | "yes" | "unknown";

export interface PublicRpc {
  url: string;
  host: string;
  /** The registered domain, e.g. "publicnode.com". Two URLs with the same provider count as one source. */
  provider: string;
  tracking: Tracking;
  /**
   * The result of the server's last check (see probeRpc.ts): "ok" answered with the right chain id and allows
   * browser requests; "down" did not; "unchecked" was not tested (only the first candidates are).
   */
  health: "ok" | "down" | "unchecked";
}

export interface ChainRpcs {
  chainId: number;
  /** False if Chainlist has no entry for the chain */
  known: boolean;
  name?: string;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  explorers: string[];
  /** All usable endpoints, best first */
  rpcs: PublicRpc[];
  /** The two endpoints that a read asks by default: the best two from different providers (fewer if there are fewer) */
  defaults: string[];
}

/** One chain as it appears in rpcs.json (only the fields that we read). */
export interface ChainlistEntry {
  chainId: number;
  name?: string;
  rpc?: Array<string | { url?: string; tracking?: string }>;
  nativeCurrency?: { name: string; symbol: string; decimals: number };
  explorers?: Array<{ url?: string }>;
}

const TRACKING_ORDER: Record<Tracking, number> = { none: 0, limited: 1, unknown: 2, yes: 3 };

// Public suffixes with two labels that RPC hosts could use. A full public suffix list is not
// worth its size here: a wrong guess only means that two URLs count as different providers.
const TWO_LABEL_SUFFIXES = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.kr", "com.cn", "co.in"]);

/** "ethereum-rpc.publicnode.com" -> "publicnode.com". An IP address stays as it is. */
export function providerOf(host: string): string {
  const name = host.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(name) || name.includes(":")) return name;
  const labels = name.split(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_LABEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

function toTracking(value: unknown): Tracking {
  return value === "none" || value === "limited" || value === "yes" ? value : "unknown";
}

/**
 * The endpoints that a browser can use: https only, and no placeholder for an API key
 * (Chainlist writes those as ${INFURA_API_KEY} or {API_KEY}). Duplicates are dropped.
 * Sorted by tracking label (none, limited, unknown, yes); the order of the file stays inside a label.
 */
export function usableRpcs(entry: ChainlistEntry): PublicRpc[] {
  const seen = new Set<string>();
  const rpcs: PublicRpc[] = [];
  for (const item of entry.rpc ?? []) {
    const raw = typeof item === "string" ? item : item.url;
    if (!raw || /[{}$]/.test(raw)) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    const href = url.href.replace(/\/$/, "");
    if (seen.has(href)) continue;
    seen.add(href);
    rpcs.push({
      url: href,
      host: url.host,
      provider: providerOf(url.hostname),
      tracking: toTracking(typeof item === "string" ? undefined : item.tracking),
      health: "unchecked",
    });
  }
  // Array.prototype.sort is stable, so the order of the file stays within a label
  return rpcs.sort((a, b) => TRACKING_ORDER[a.tracking] - TRACKING_ORDER[b.tracking]);
}

/** The default pair: the first endpoints, in order, that belong to different providers. Endpoints that are down are skipped. */
export function pickDefaults(rpcs: PublicRpc[], count = 2): string[] {
  const providers = new Set<string>();
  const picked: string[] = [];
  for (const rpc of rpcs) {
    if (rpc.health === "down") continue;
    if (providers.has(rpc.provider)) continue;
    providers.add(rpc.provider);
    picked.push(rpc.url);
    if (picked.length === count) break;
  }
  return picked;
}

/**
 * What the API route returns for one chain. `health` has the result of the server's check per URL;
 * endpoints that are down move to the end of the list and never become defaults.
 */
export function chainRpcs(
  chainId: number,
  entry: ChainlistEntry | undefined,
  health?: Map<string, boolean>
): ChainRpcs {
  if (!entry) return { chainId, known: false, explorers: [], rpcs: [], defaults: [] };
  const checked = usableRpcs(entry).map((rpc) => {
    const ok = health?.get(rpc.url);
    return ok === undefined ? rpc : { ...rpc, health: ok ? ("ok" as const) : ("down" as const) };
  });
  const rpcs = [...checked.filter((rpc) => rpc.health !== "down"), ...checked.filter((rpc) => rpc.health === "down")];
  return {
    chainId,
    known: true,
    name: entry.name,
    nativeCurrency: entry.nativeCurrency,
    explorers: (entry.explorers ?? []).flatMap((explorer) =>
      explorer.url?.startsWith("https://") ? [explorer.url.replace(/\/$/, "")] : []
    ),
    rpcs,
    defaults: pickDefaults(rpcs),
  };
}

/** Indexes the Chainlist file by chain id. Entries without a numeric chain id are skipped. */
export function indexChainlist(list: unknown): Map<number, ChainlistEntry> {
  const index = new Map<number, ChainlistEntry>();
  if (!Array.isArray(list)) return index;
  for (const entry of list as ChainlistEntry[]) {
    if (entry && Number.isInteger(entry.chainId)) index.set(entry.chainId, entry);
  }
  return index;
}

/** A custom RPC URL: https anywhere; plain http only for a node on this computer (browsers allow that from an https page). */
export function isAllowedRpcUrl(text: string): boolean {
  try {
    const url = new URL(text);
    if (url.protocol === "https:") return url.hostname.includes(".") || url.hostname === "localhost";
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
