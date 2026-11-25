import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_SLOTS, clearProxyAdminCache, proxyAdmin } from "./proxyAdmin";

const PROXY = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const word = (address: string) => `0x${"0".repeat(24)}${address.slice(2)}`;

function node(slots: Record<string, string>, calls: string[] = []) {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const { id, params } = JSON.parse(String(init?.body));
    calls.push(params[1]);
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, result: slots[params[1]] ?? `0x${"0".repeat(64)}` }));
  }) as typeof fetch;
}

beforeEach(() => clearProxyAdminCache());

describe("proxyAdmin", () => {
  it("finds the admin in the EIP-1967 slot", async () => {
    const admin = "0x807a96288a1a408dbc13de2b1d087d10356395d2";
    expect(await proxyAdmin("1", PROXY, ["https://a"], { fetchImpl: node({ [ADMIN_SLOTS[0]]: word(admin) }) })).toBe(
      admin
    );
  });

  it("falls back to the ZeppelinOS slot, and keeps the answer", async () => {
    const admin = "0x807a96288a1a408dbc13de2b1d087d10356395d2";
    const calls: string[] = [];
    const fetchImpl = node({ [ADMIN_SLOTS[1]]: word(admin) }, calls);
    expect(await proxyAdmin("1", PROXY, ["https://a"], { fetchImpl })).toBe(admin);
    expect(await proxyAdmin("1", PROXY, ["https://a"], { fetchImpl })).toBe(admin);
    expect(calls).toEqual([ADMIN_SLOTS[0], ADMIN_SLOTS[1]]);
  });

  it("gives null when no slot holds an address, and tries the next endpoint when one fails", async () => {
    expect(await proxyAdmin("1", PROXY, ["https://a"], { fetchImpl: node({}) })).toBeNull();
    clearProxyAdminCache();
    const admin = "0x1111111111111111111111111111111111111111";
    let first = true;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (first) {
        first = false;
        return new Response("down", { status: 503 });
      }
      return node({ [ADMIN_SLOTS[0]]: word(admin) })(input, init);
    }) as typeof fetch;
    expect(await proxyAdmin("1", PROXY, ["https://down", "https://up"], { fetchImpl })).toBe(admin);
  });
});

describe("proxyAdmin per chain", () => {
  it("does not reuse the admin of the same address on another chain", async () => {
    const one = "0x1111111111111111111111111111111111111111";
    const two = "0x2222222222222222222222222222222222222222";
    expect(await proxyAdmin("1", PROXY, ["https://a"], { fetchImpl: node({ [ADMIN_SLOTS[0]]: word(one) }) })).toBe(one);
    expect(await proxyAdmin("8453", PROXY, ["https://b"], { fetchImpl: node({ [ADMIN_SLOTS[0]]: word(two) }) })).toBe(
      two
    );
  });
});
