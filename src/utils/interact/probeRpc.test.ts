import { beforeEach, describe, expect, it } from "vitest";
import { chainHealth, clearHealthCache, isPrivateHost, probeRpc } from "./probeRpc";

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

describe("probeRpc safety", () => {
  it("never contacts a private, loopback or link-local host", async () => {
    const calls: string[] = [];
    const fetchImpl = network(
      {
        "http://127.0.0.1:8545": {},
        "https://10.1.2.3": {},
        "https://[::1]": {},
        "https://localhost": {},
        "https://169.254.169.254": {},
      },
      calls
    );
    for (const url of [
      "http://127.0.0.1:8545",
      "https://10.1.2.3",
      "https://[::1]",
      "https://localhost",
      "https://169.254.169.254",
    ])
      expect(await probeRpc(url, 1, fetchImpl)).toBe(false);
    expect(calls).toEqual([]);
  });

  it("asks fetch not to follow redirects", async () => {
    let redirect: RequestRedirect | undefined;
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      redirect = init?.redirect;
      return network({ "https://ok.example.com": {} })("https://ok.example.com");
    }) as typeof fetch;
    expect(await probeRpc("https://ok.example.com", 1, fetchImpl)).toBe(true);
    expect(redirect).toBe("error");
  });
});

describe("isPrivateHost", () => {
  it("knows the private, loopback, link-local and unique-local ranges", () => {
    for (const host of [
      "localhost",
      "node.localhost",
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.4",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.90.127.83",
      "0.0.0.0",
      "[::1]",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "::ffff:a00:1",
    ])
      expect(isPrivateHost(host), host).toBe(true);
    for (const host of ["ethereum-rpc.publicnode.com", "8.8.8.8", "172.32.0.1", "192.169.0.1", "2606:4700::1111"])
      expect(isPrivateHost(host), host).toBe(false);
  });
});
