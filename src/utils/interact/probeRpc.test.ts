import { beforeEach, describe, expect, it } from "vitest";
import { chainHealth, clearHealthCache, probeRpc } from "./probeRpc";

type Reply = { status?: number; chainId?: number; cors?: string | null; throws?: boolean; html?: boolean };

function network(replies: Record<string, Reply>, calls: string[] = []) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const reply = replies[url] ?? { throws: true };
    if (reply.throws) throw new TypeError("fetch failed");
    const headers = new Headers();
    if (reply.cors !== null) headers.set("access-control-allow-origin", reply.cors ?? "*");
    const body = reply.html
      ? "<html>"
      : JSON.stringify({ jsonrpc: "2.0", id: 1, result: `0x${(reply.chainId ?? 1).toString(16)}` });
    return new Response(body, { status: reply.status ?? 200, headers });
  }) as typeof fetch;
}

beforeEach(() => clearHealthCache());

describe("probeRpc", () => {
  it("passes an endpoint with the right chain and browser access, and fails the others", async () => {
    const fetchImpl = network({
      "https://ok.example.com": {},
      "https://wrong-chain.example.com": { chainId: 11155111 },
      "https://no-cors.example.com": { cors: null },
      "https://down.example.com": { status: 530 },
      "https://html.example.com": { html: true },
    });
    expect(await probeRpc("https://ok.example.com", 1, fetchImpl)).toBe(true);
    expect(await probeRpc("https://wrong-chain.example.com", 1, fetchImpl)).toBe(false);
    expect(await probeRpc("https://no-cors.example.com", 1, fetchImpl)).toBe(false);
    expect(await probeRpc("https://down.example.com", 1, fetchImpl)).toBe(false);
    expect(await probeRpc("https://html.example.com", 1, fetchImpl)).toBe(false);
    expect(await probeRpc("https://unreachable.example.com", 1, fetchImpl)).toBe(false);
  });
});

describe("chainHealth", () => {
  it("checks rounds until two providers pass, and keeps the result for an hour", async () => {
    const rpc = Array.from({ length: 12 }, (_, i) => ({ url: `https://p${i}.example${i}.com`, tracking: "none" }));
    const replies: Record<string, Reply> = Object.fromEntries(
      rpc.map((item, i) => [item.url, i < 9 ? { status: 503 } : {}])
    );
    const calls: string[] = [];
    const health = await chainHealth(1, { chainId: 1, rpc }, network(replies, calls), 0);
    // Round 1 (8 endpoints) finds none, round 2 checks the other 4
    expect(calls).toHaveLength(12);
    expect([...health.values()].filter(Boolean)).toHaveLength(3);
    await chainHealth(1, { chainId: 1, rpc }, network(replies, calls), 1000);
    expect(calls).toHaveLength(12);
  });

  it("stops after the first round when two providers pass", async () => {
    const rpc = Array.from({ length: 12 }, (_, i) => ({ url: `https://p${i}.example${i}.com`, tracking: "none" }));
    const calls: string[] = [];
    await chainHealth(1, { chainId: 1, rpc }, network(Object.fromEntries(rpc.map((item) => [item.url, {}])), calls), 0);
    expect(calls).toHaveLength(8);
  });
});
