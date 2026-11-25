import { beforeEach, describe, expect, it } from "vitest";
import { BLOCK_CACHE_MS, clearBlockCache, isRevert, jsonRpc, latestBlock, readFromSources, RpcError } from "./rpcRead";

type Reply = { status?: number; body?: unknown; throws?: Error };
type Node = (method: string, params: unknown[]) => Reply;

/** A fake fetch: each URL is a node that answers by method. Records every request. */
function fakeNetwork(nodes: Record<string, Node>) {
  const requests: Array<{ url: string; method: string; params: unknown[] }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const { id, method, params } = JSON.parse(String(init?.body));
    requests.push({ url, method, params });
    const reply = nodes[url](method, params);
    if (reply.throws) throw reply.throws;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, ...(reply.body as object) }), {
      status: reply.status ?? 200,
    });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const node =
  (block: number, call: Reply | ((params: unknown[]) => Reply)): Node =>
  (method, params) =>
    method === "eth_blockNumber"
      ? { body: { result: `0x${block.toString(16)}` } }
      : typeof call === "function"
        ? call(params)
        : call;

const A = "https://a.example.com";
const B = "https://b.example.org";
const CALL = { to: "0x0000000000000000000000000000000000000001", data: "0x06fdde03" };
const RESULT = "0x000000000000000000000000000000000000000000000000000000000000002A";

beforeEach(() => clearBlockCache());

describe("readFromSources", () => {
  it("agrees when both nodes give the same answer, and reads both at the lower block", async () => {
    const { fetchImpl, requests } = fakeNetwork({
      [A]: node(101, { body: { result: RESULT } }),
      [B]: node(100, { body: { result: RESULT.toLowerCase() } }),
    });
    const result = await readFromSources([A, B], CALL, { fetchImpl });
    expect(result.check).toBe("agree");
    if (result.check === "all-failed") throw new Error("unexpected");
    expect(result.block).toBe(100);
    expect(result.answer).toEqual({ kind: "return", data: RESULT.toLowerCase() });
    const calls = requests.filter((request) => request.method === "eth_call");
    expect(calls.map((request) => request.params[1])).toEqual(["0x64", "0x64"]);
    expect(calls[0].params[0]).toEqual(CALL);
  });

  it("reports a mismatch and keeps both answers", async () => {
    const { fetchImpl } = fakeNetwork({
      [A]: node(100, { body: { result: RESULT } }),
      [B]: node(100, { body: { result: "0x01" } }),
    });
    const result = await readFromSources([A, B], CALL, { fetchImpl });
    expect(result.check).toBe("mismatch");
    expect(result.sources.map((source) => source.ok && source.answer.data)).toEqual([RESULT.toLowerCase(), "0x01"]);
  });

  it("counts two equal reverts as agreement", async () => {
    const revert = { body: { error: { code: 3, message: "execution reverted", data: "0xCF479181" } } };
    const revert2 = {
      body: { error: { code: -32000, message: "execution reverted: custom error", data: "0xcf479181" } },
    };
    const { fetchImpl } = fakeNetwork({ [A]: node(100, revert), [B]: node(100, revert2) });
    const result = await readFromSources([A, B], CALL, { fetchImpl });
    expect(result.check).toBe("agree");
    if (result.check === "all-failed") throw new Error("unexpected");
    expect(result.answer).toMatchObject({ kind: "revert", data: "0xcf479181" });
  });

  it("uses the other node when one fails its block number or its call", async () => {
    const down = {
      fetchImpl: fakeNetwork({ [A]: () => ({ status: 503 }), [B]: node(100, { body: { result: RESULT } }) }).fetchImpl,
    };
    const first = await readFromSources([A, B], CALL, down);
    expect(first.check).toBe("one-failed");
    expect(first.sources[0]).toMatchObject({ url: A, ok: false, problem: "HTTP 503" });

    clearBlockCache();
    const callFails = fakeNetwork({
      [A]: node(100, { status: 429 }),
      [B]: node(100, { body: { result: RESULT } }),
    });
    const second = await readFromSources([A, B], CALL, { fetchImpl: callFails.fetchImpl });
    expect(second.check).toBe("one-failed");
    expect(second.sources[0]).toMatchObject({ ok: false, problem: "rate limited: too many calls" });
  });

  it("fails when no node answers, and says why", async () => {
    const { fetchImpl } = fakeNetwork({
      [A]: () => ({ throws: new TypeError("Failed to fetch") }),
      [B]: () => ({ body: { error: { code: -32603, message: "internal error" } } }),
    });
    const result = await readFromSources([A, B], CALL, { fetchImpl });
    expect(result.check).toBe("all-failed");
    expect(result.sources.map((source) => !source.ok && source.problem)).toEqual([
      "no connection (network error or blocked by the browser)",
      "internal error",
    ]);
  });

  it("marks a read from one node as single, and handles no node", async () => {
    const { fetchImpl } = fakeNetwork({ [A]: node(7, { body: { result: RESULT } }) });
    expect((await readFromSources([A], CALL, { fetchImpl })).check).toBe("single");
    expect(await readFromSources([], CALL, { fetchImpl })).toEqual({ check: "all-failed", sources: [] });
  });

  it("sends the sender when the call has one", async () => {
    const { fetchImpl, requests } = fakeNetwork({ [A]: node(7, { body: { result: RESULT } }) });
    const from = "0x00000000000000000000000000000000000000ff";
    await readFromSources([A], { ...CALL, from }, { fetchImpl });
    expect(requests.find((request) => request.method === "eth_call")?.params[0]).toEqual({ ...CALL, from });
  });
});

describe("latestBlock", () => {
  it("reuses a block number for a few seconds", async () => {
    let time = 1000;
    const { fetchImpl, requests } = fakeNetwork({ [A]: node(5, { body: { result: "0x" } }) });
    await latestBlock(A, { fetchImpl, now: () => time });
    time += BLOCK_CACHE_MS - 1;
    await latestBlock(A, { fetchImpl, now: () => time });
    expect(requests).toHaveLength(1);
    time += 2;
    await latestBlock(A, { fetchImpl, now: () => time });
    expect(requests).toHaveLength(2);
  });
});

describe("jsonRpc and isRevert", () => {
  it("tells a revert from a problem of the node", async () => {
    const { fetchImpl } = fakeNetwork({
      [A]: () => ({ body: { error: { code: 3, message: "execution reverted", data: "0x" } } }),
    });
    const error = await jsonRpc(A, "eth_call", [], { fetchImpl }).catch((caught) => caught);
    expect(error).toBeInstanceOf(RpcError);
    expect(isRevert(error)).toBe(true);
    expect(isRevert(new RpcError("HTTP 500", undefined, undefined, 500))).toBe(false);
    expect(isRevert(new RpcError("header not found", -32000))).toBe(false);
  });

  it("rejects an answer that is not JSON", async () => {
    const fetchImpl = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(jsonRpc(A, "eth_blockNumber", [], { fetchImpl })).rejects.toThrow("the answer is not JSON");
  });
});

describe("revert data in an object", () => {
  it("reads { data: '0x…' } as the revert data", async () => {
    const { fetchImpl } = fakeNetwork({
      [A]: node(100, { body: { error: { code: 3, message: "execution reverted", data: { data: "0x9E87FAC8" } } } }),
    });
    const result = await readFromSources([A], CALL, { fetchImpl });
    if (result.check === "all-failed") throw new Error("unexpected");
    expect(result.answer).toMatchObject({ kind: "revert", data: "0x9e87fac8" });
  });
});
