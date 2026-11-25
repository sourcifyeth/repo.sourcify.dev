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

export type SourceResult =
  { url: string; ok: true; answer: Answer; ms: number } | { url: string; ok: false; problem: string; ms: number };

export type ReadResult =
  | {
      /** agree: two answers, equal. mismatch: two answers, different. one-failed: two asked, one answered. single: one asked. */
      check: "agree" | "mismatch" | "one-failed" | "single";
      block: number;
      /** The answer of the first endpoint that answered. For a mismatch, see `sources` for both. */
      answer: Answer;
      sources: SourceResult[];
    }
  | { check: "all-failed"; sources: SourceResult[] };

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

  const block = Math.min(...alive.map((url) => heads[asked.indexOf(url)].value!));
  const blockHex = `0x${block.toString(16)}`;
  const tx = { to: call.to, data: call.data, ...(call.from ? { from: call.from } : {}) };

  const calls = await Promise.all(
    alive.map((url) => timed(() => jsonRpc<string>(url, "eth_call", [tx, blockHex], options), now))
  );
  alive.forEach((url, i) => {
    const { value, error, ms } = calls[i];
    if (value !== undefined)
      results.set(url, { url, ok: true, answer: { kind: "return", data: value.toLowerCase() }, ms });
    else if (isRevert(error))
      results.set(url, {
        url,
        ok: true,
        answer: { kind: "revert", data: (error.data ?? "0x").toLowerCase(), message: error.message },
        ms,
      });
    else results.set(url, { url, ok: false, problem: problemOf(error), ms });
  });

  const sources = asked.map((url) => results.get(url)!);
  const answered = sources.filter((source): source is Extract<SourceResult, { ok: true }> => source.ok);
  if (answered.length === 0) return { check: "all-failed", sources };
  const first = answered[0].answer;
  if (asked.length === 1) return { check: "single", block, answer: first, sources };
  if (answered.length === 1) return { check: "one-failed", block, answer: first, sources };
  const [a, b] = answered.map((source) => source.answer);
  const same = a.kind === b.kind && a.data === b.data;
  return { check: same ? "agree" : "mismatch", block, answer: first, sources };
}
