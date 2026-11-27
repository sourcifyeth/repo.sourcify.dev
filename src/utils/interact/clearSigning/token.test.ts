import { beforeEach, describe, expect, it } from "vitest";
import { encodeAbiParameters, stringToHex } from "viem";
import { clearBlockCache } from "../rpcRead";
import { clearTokenCache, readTokenInfo } from "./token";

const TOKEN = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const word = (value: number) => `0x${value.toString(16).padStart(64, "0")}`;
const text = (value: string) => encodeAbiParameters([{ type: "string" }], [value]);

/** A fetch that answers eth_blockNumber and eth_call for each endpoint. */
function rpc(answers: Record<string, { decimals?: string | null; symbol?: string | null }>) {
  const calls: Array<{ url: string; data?: string }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: number; method: string; params: Array<{ data?: string }> };
    const answer = answers[url];
    if (!answer) throw new Error("down");
    if (body.method === "eth_blockNumber") return Response.json({ jsonrpc: "2.0", id: body.id, result: "0x10" });
    const data = body.params[0].data;
    calls.push({ url, data });
    const result = data === "0x313ce567" ? answer.decimals : answer.symbol;
    if (result === null || result === undefined)
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("readTokenInfo", () => {
  beforeEach(() => {
    clearTokenCache();
    clearBlockCache();
  });

  it("reads decimals and symbol from two endpoints, once", async () => {
    const good = { decimals: word(6), symbol: text("USDT") };
    const { fetchImpl, calls } = rpc({ "https://a": good, "https://b": good });
    const urls = ["https://a", "https://b"];
    expect(await readTokenInfo(1, TOKEN, urls, { fetchImpl })).toEqual({ decimals: 6, symbol: "USDT" });
    expect(calls).toHaveLength(4);
    // The second read of the same token uses the first answer
    expect(await readTokenInfo("1", TOKEN.toLowerCase(), urls, { fetchImpl })).toEqual({ decimals: 6, symbol: "USDT" });
    expect(calls).toHaveLength(4);
    expect(calls.every((call) => call.data === "0x313ce567" || call.data === "0x95d89b41")).toBe(true);
  });

  it("refuses decimals that the two endpoints do not agree on", async () => {
    const { fetchImpl } = rpc({
      "https://a": { decimals: word(6), symbol: text("USDT") },
      "https://b": { decimals: word(18), symbol: text("USDT") },
    });
    await expect(readTokenInfo(1, TOKEN, ["https://a", "https://b"], { fetchImpl })).rejects.toThrow(
      "different answers"
    );
  });

  it("fails if decimals() reverts or gives nothing, and can be tried again", async () => {
    const bad = rpc({ "https://a": { decimals: null, symbol: text("X") } });
    await expect(readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: bad.fetchImpl })).rejects.toThrow("reverted");
    const empty = rpc({ "https://a": { decimals: "0x", symbol: text("X") } });
    await expect(readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: empty.fetchImpl })).rejects.toThrow("no number");
    const huge = rpc({ "https://a": { decimals: word(200), symbol: text("X") } });
    await expect(readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: huge.fetchImpl })).rejects.toThrow("out of range");
    const good = rpc({ "https://a": { decimals: word(18), symbol: text("X") } });
    expect(await readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: good.fetchImpl })).toEqual({
      decimals: 18,
      symbol: "X",
    });
  });

  it("works without a symbol, and with a bytes32 symbol", async () => {
    const none = rpc({ "https://a": { decimals: word(8), symbol: null } });
    expect(await readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: none.fetchImpl })).toEqual({
      decimals: 8,
      symbol: "",
    });
    clearTokenCache();
    const old = rpc({ "https://a": { decimals: word(18), symbol: stringToHex("MKR", { size: 32 }) } });
    expect(await readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: old.fetchImpl })).toEqual({
      decimals: 18,
      symbol: "MKR",
    });
  });

  it("keeps a symbol short and on one line", async () => {
    const odd = rpc({ "https://a": { decimals: word(18), symbol: text(`A\n  B ${"x".repeat(80)}`) } });
    const info = await readTokenInfo(1, TOKEN, ["https://a"], { fetchImpl: odd.fetchImpl });
    expect(info.symbol).toBe(`A B ${"x".repeat(20)}`);
  });
});
