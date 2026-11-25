/**
 * Read calls to public RPC endpoints, sent from the browser. Each read asks two endpoints for the
 * same block and compares the raw answers, so that a wrong or late provider shows up.
 * No library: plain JSON-RPC over fetch. The caller decodes the answer with the ABI.
 */

export interface CallRequest {
  to: string;
  data: string;
  /** Optional sender, for functions that read msg.sender */
  from?: string;
}

/** What one endpoint answered: the return data, or a revert with its data. */
export type Answer = { kind: "return"; data: string } | { kind: "revert"; data: string; message: string };

/** What one endpoint did. `head` is its newest block, if it answered eth_blockNumber. */
export type SourceResult =
  | { url: string; ok: true; answer: Answer; ms: number; head?: number }
  | { url: string; ok: false; problem: string; ms: number; head?: number };

/**
 * The two endpoints had different newest blocks. The read used the lower one, so the value is as old as
 * the endpoint that is behind. `ageSeconds`: the age of the read block, from the endpoint that is ahead
 * (undefined if it did not answer).
 */
export interface HeadGap {
  behindUrl: string;
  aheadUrl: string;
  behindHead: number;
  aheadHead: number;
  blocks: number;
  ageSeconds?: number;
}

export type ReadResult =
  | {
      /** agree: two answers, equal. mismatch: two answers, different. one-failed: two asked, one answered. single: one asked. */
      check: "agree" | "mismatch" | "one-failed" | "single";
      block: number;
      /** The answer of the first endpoint that answered. For a mismatch, see `sources` for both. */
      answer: Answer;
      sources: SourceResult[];
      /** Set if the two newest blocks differ, by any number of blocks */
      gap?: HeadGap;
    }
  | { check: "all-failed"; sources: SourceResult[] };

/** A gap counts as large if the read block is older than this, or (without its time) the gap is this many blocks. */
export const LARGE_GAP_SECONDS = 60;
export const LARGE_GAP_BLOCKS = 5;

/** True if the note about the gap should be a warning (amber), not a quiet note (grey). */
export function isLargeGap(gap: HeadGap): boolean {
  return gap.ageSeconds !== undefined ? gap.ageSeconds > LARGE_GAP_SECONDS : gap.blocks >= LARGE_GAP_BLOCKS;
}

/** "45 s", "12 min", "3 h", "2 days" */
export function formatAge(seconds: number): string {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))} s`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} min`;
  if (seconds < 36 * 3600) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} days`;
}

export interface RpcOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** A JSON-RPC error. `code` and `data` come from the endpoint; HTTP problems have no code. */
export class RpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly data?: string,
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "RpcError";
  }
}

let requestId = 0;

/** One JSON-RPC request. Throws RpcError for an HTTP problem, a timeout or an error in the answer. */
export async function jsonRpc<T>(url: string, method: string, params: unknown[], options: RpcOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    // A browser reports a blocked cross-origin request (CORS) as a plain network error
    throw new RpcError(timedOut ? "no answer in time" : "no connection (network error or blocked by the browser)");
  }
  if (response.status === 429) throw new RpcError("rate limited: too many calls", undefined, undefined, 429);
  if (!response.ok) throw new RpcError(`HTTP ${response.status}`, undefined, undefined, response.status);
  let body: { result?: T; error?: { code?: number; message?: string; data?: unknown } };
  try {
    body = await response.json();
  } catch {
    throw new RpcError("the answer is not JSON");
  }
  if (body.error) {
    // Most nodes give the revert data as a string; some wrap it in an object: { data: "0x…" }
    const raw = body.error.data as unknown;
    const nested = (raw as { data?: unknown } | null)?.data;
    const data = typeof raw === "string" ? raw : typeof nested === "string" ? nested : undefined;
    throw new RpcError(body.error.message || "error without a message", body.error.code, data);
  }
  if (body.result === undefined) throw new RpcError("the answer has no result");
  return body.result;
}

/**
 * True if the error is the contract reverting, not a problem of the endpoint. Nodes differ: Geth and
 * most providers use code 3 with the revert data; others use -32000 or -32015 and the text "revert".
 */
export function isRevert(error: unknown): error is RpcError {
  if (!(error instanceof RpcError) || error.httpStatus !== undefined) return false;
  if (error.code === 3) return true;
  return /revert/i.test(error.message);
}

const blockCache = new Map<string, { block: number; at: number }>();
/** How long one block number serves all reads to the same endpoint. */
export const BLOCK_CACHE_MS = 4000;

/** The latest block number of an endpoint. Reused for a few seconds, so that many reads cost one request. */
export async function latestBlock(url: string, options: RpcOptions = {}): Promise<number> {
  const now = (options.now ?? Date.now)();
  const hit = blockCache.get(url);
  if (hit && now - hit.at < BLOCK_CACHE_MS) return hit.block;
  const hex = await jsonRpc<string>(url, "eth_blockNumber", [], options);
  const block = Number.parseInt(hex, 16);
  if (!Number.isSafeInteger(block) || block < 0) throw new RpcError(`a wrong block number: ${hex}`);
  blockCache.set(url, { block, at: now });
  return block;
}

/** For tests */
export function clearBlockCache() {
  blockCache.clear();
}

async function timed<T>(run: () => Promise<T>, now: () => number): Promise<{ value?: T; error?: unknown; ms: number }> {
  const start = now();
  try {
    return { value: await run(), ms: now() - start };
  } catch (error) {
    return { error, ms: now() - start };
  }
}

const problemOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Reads from one or two endpoints at the same block:
 * 1. Ask each endpoint for its latest block. Endpoints that fail drop out.
 * 2. Take the lowest of these blocks, so that both endpoints have it.
 * 3. Send the same eth_call to each endpoint at that block. A revert is an answer, not a failure.
 * 4. Compare the raw answers.
 */
export async function readFromSources(
  urls: string[],
  call: CallRequest,
  options: RpcOptions = {}
): Promise<ReadResult> {
  const now = options.now ?? Date.now;
  const asked = urls.slice(0, 2);
  if (asked.length === 0) return { check: "all-failed", sources: [] };

  const heads = await Promise.all(asked.map((url) => timed(() => latestBlock(url, options), now)));
  const alive = asked.filter((_, i) => heads[i].value !== undefined);
  const results = new Map<string, SourceResult>();
  asked.forEach((url, i) => {
    if (heads[i].value === undefined)
      results.set(url, { url, ok: false, problem: problemOf(heads[i].error), ms: heads[i].ms });
  });
  if (alive.length === 0) return { check: "all-failed", sources: asked.map((url) => results.get(url)!) };

  const headOf = (url: string) => heads[asked.indexOf(url)].value!;
  const block = Math.min(...alive.map(headOf));
  const blockHex = `0x${block.toString(16)}`;
  const tx = { to: call.to, data: call.data, ...(call.from ? { from: call.from } : {}) };

  // Two different newest blocks: the read uses the lower one. Ask the endpoint that is ahead how old that block is.
  const [low, high] = [...alive].sort((x, y) => headOf(x) - headOf(y));
  const gapPromise: Promise<HeadGap | undefined> =
    alive.length === 2 && headOf(high) > headOf(low)
      ? jsonRpc<{ timestamp?: string } | null>(high, "eth_getBlockByNumber", [blockHex, false], options)
          .then((found) => Number.parseInt(found?.timestamp ?? "", 16))
          .catch(() => Number.NaN)
          .then((timestamp) => ({
            behindUrl: low,
            aheadUrl: high,
            behindHead: headOf(low),
            aheadHead: headOf(high),
            blocks: headOf(high) - headOf(low),
            ...(Number.isFinite(timestamp) ? { ageSeconds: Math.max(0, now() / 1000 - timestamp) } : {}),
          }))
      : Promise.resolve(undefined);

  const [calls, gap] = await Promise.all([
    Promise.all(alive.map((url) => timed(() => jsonRpc<unknown>(url, "eth_call", [tx, blockHex], options), now))),
    gapPromise,
  ]);
  alive.forEach((url, i) => {
    const { value, error, ms } = calls[i];
    const head = headOf(url);
    if (value !== undefined) {
      // Return data is hex text; anything else is a broken endpoint, not an answer
      if (typeof value === "string" && /^0x([0-9a-fA-F]{2})*$/.test(value))
        results.set(url, { url, ok: true, answer: { kind: "return", data: value.toLowerCase() }, ms, head });
      else results.set(url, { url, ok: false, problem: "the answer is not hex data", ms, head });
    } else if (isRevert(error))
      results.set(url, {
        url,
        ok: true,
        answer: { kind: "revert", data: (error.data ?? "0x").toLowerCase(), message: error.message },
        ms,
        head,
      });
    else results.set(url, { url, ok: false, problem: problemOf(error), ms, head });
  });

  const sources = asked.map((url) => results.get(url)!);
  const answered = sources.filter((source): source is Extract<SourceResult, { ok: true }> => source.ok);
  if (answered.length === 0) return { check: "all-failed", sources };
  const first = answered[0].answer;
  const extra = gap ? { gap } : {};
  if (asked.length === 1) return { check: "single", block, answer: first, sources, ...extra };
  if (answered.length === 1) return { check: "one-failed", block, answer: first, sources, ...extra };
  const [a, b] = answered.map((source) => source.answer);
  const same = a.kind === b.kind && a.data === b.data;
  return { check: same ? "agree" : "mismatch", block, answer: first, sources, ...extra };
}
