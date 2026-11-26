import { describe, expect, it } from "vitest";
import {
  chainRpcs,
  indexChainlist,
  isAllowedRpcUrl,
  pickDefaults,
  providerOf,
  usableRpcs,
  walletRpcsOf,
} from "./chainRpcs";

describe("providerOf", () => {
  it("takes the registered domain", () => {
    expect(providerOf("ethereum-rpc.publicnode.com")).toBe("publicnode.com");
    expect(providerOf("rpc.ankr.com")).toBe("ankr.com");
    expect(providerOf("xrpc.cl")).toBe("xrpc.cl");
    expect(providerOf("node.example.co.uk")).toBe("example.co.uk");
    expect(providerOf("10.0.0.1")).toBe("10.0.0.1");
  });
});

describe("usableRpcs", () => {
  it("keeps https URLs without key placeholders, without duplicates, best tracking first", () => {
    const rpcs = usableRpcs({
      chainId: 1,
      rpc: [
        { url: "https://tracker.example.com", tracking: "yes" },
        { url: "https://mainnet.infura.io/v3/${INFURA_API_KEY}" },
        { url: "https://lb.drpc.live/ethereum/{API_KEY}" },
        { url: "wss://ethereum-rpc.publicnode.com" },
        { url: "http://insecure.example.org" },
        "https://plain-string.example.net/",
        { url: "https://rpc.ankr.com/eth", tracking: "limited" },
        { url: "https://ethereum-rpc.publicnode.com", tracking: "none" },
        { url: "https://ethereum-rpc.publicnode.com/", tracking: "none" },
        { url: "not a url" },
      ],
    });
    expect(rpcs.map((rpc) => [rpc.url, rpc.tracking])).toEqual([
      ["https://ethereum-rpc.publicnode.com", "none"],
      ["https://rpc.ankr.com/eth", "limited"],
      ["https://plain-string.example.net", "unknown"],
      ["https://tracker.example.com", "yes"],
    ]);
  });
});

describe("pickDefaults", () => {
  it("takes two endpoints from different providers", () => {
    const rpcs = usableRpcs({
      chainId: 1,
      rpc: [
        { url: "https://a.publicnode.com", tracking: "none" },
        { url: "https://b.publicnode.com", tracking: "none" },
        { url: "https://rpc.nodeflare.app/eth", tracking: "none" },
      ],
    });
    expect(pickDefaults(rpcs)).toEqual(["https://a.publicnode.com", "https://rpc.nodeflare.app/eth"]);
  });

  it("gives one or none when the chain has fewer providers", () => {
    expect(pickDefaults(usableRpcs({ chainId: 5, rpc: [{ url: "https://only.example.com" }] }))).toEqual([
      "https://only.example.com",
    ]);
    expect(pickDefaults([])).toEqual([]);
  });
});

describe("chainRpcs and indexChainlist", () => {
  const index = indexChainlist([
    {
      chainId: 10,
      name: "OP Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpc: [{ url: "https://mainnet.optimism.io" }],
      explorers: [{ url: "https://optimistic.etherscan.io/" }, { url: "http://insecure.example" }],
    },
    { name: "no chain id" },
    null,
  ]);

  it("indexes entries with a chain id", () => {
    expect([...index.keys()]).toEqual([10]);
  });

  it("gives the endpoints, defaults, currency and explorers of a known chain", () => {
    expect(chainRpcs(10, index.get(10))).toEqual({
      chainId: 10,
      known: true,
      name: "OP Mainnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      explorers: ["https://optimistic.etherscan.io"],
      rpcs: [
        {
          url: "https://mainnet.optimism.io",
          host: "mainnet.optimism.io",
          provider: "optimism.io",
          tracking: "unknown",
          health: "unchecked",
        },
      ],
      defaults: ["https://mainnet.optimism.io"],
      walletRpcs: [],
    });
  });

  it("marks an unknown chain", () => {
    expect(chainRpcs(999, undefined)).toEqual({
      chainId: 999,
      known: false,
      explorers: [],
      rpcs: [],
      defaults: [],
      walletRpcs: [],
    });
  });
});

describe("health", () => {
  const entry = {
    chainId: 1,
    rpc: [
      { url: "https://dead.example.com", tracking: "none" },
      { url: "https://a.publicnode.com", tracking: "none" },
      { url: "https://b.nodeflare.app", tracking: "none" },
    ],
  };

  it("never picks an endpoint that is down, and moves it to the end", () => {
    const result = chainRpcs(
      1,
      entry,
      new Map([
        ["https://dead.example.com", false],
        ["https://a.publicnode.com", true],
      ])
    );
    expect(result.defaults).toEqual(["https://a.publicnode.com", "https://b.nodeflare.app"]);
    expect(result.rpcs.map((rpc) => [rpc.host, rpc.health])).toEqual([
      ["a.publicnode.com", "ok"],
      ["b.nodeflare.app", "unchecked"],
      ["dead.example.com", "down"],
    ]);
    // A wallet gets only endpoints that passed the check: not the unchecked default, not the dead one
    expect(result.walletRpcs).toEqual(["https://a.publicnode.com"]);
  });

  it("gives a wallet nothing when no endpoint passed the check", () => {
    expect(chainRpcs(1, entry).walletRpcs).toEqual([]);
    expect(chainRpcs(1, entry, new Map([["https://dead.example.com", false]])).walletRpcs).toEqual([]);
  });
});

describe("walletRpcsOf", () => {
  const rpc = (url: string, health: "ok" | "down" | "unchecked") => ({
    url,
    host: new URL(url).host,
    provider: new URL(url).host,
    tracking: "none" as const,
    health,
  });

  it("puts the checked defaults first, then other checked endpoints, at most three", () => {
    const rpcs = [
      rpc("https://a.example", "ok"),
      rpc("https://b.example", "ok"),
      rpc("https://c.example", "unchecked"),
      rpc("https://d.example", "ok"),
      rpc("https://e.example", "ok"),
      rpc("https://f.example", "down"),
    ];
    expect(walletRpcsOf(rpcs, ["https://d.example", "https://c.example"])).toEqual([
      "https://d.example",
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("never gives an endpoint that is down or was not checked", () => {
    const rpcs = [rpc("https://down.example", "down"), rpc("https://unchecked.example", "unchecked")];
    expect(walletRpcsOf(rpcs, ["https://down.example", "https://unchecked.example"])).toEqual([]);
  });
});

describe("isAllowedRpcUrl", () => {
  it("allows https, and http only for this computer", () => {
    expect(isAllowedRpcUrl("https://rpc.example.org/key")).toBe(true);
    expect(isAllowedRpcUrl("https://localhost:8545")).toBe(true);
    expect(isAllowedRpcUrl("https://127.0.0.1:8545")).toBe(true);
    expect(isAllowedRpcUrl("http://localhost:8545")).toBe(true);
    expect(isAllowedRpcUrl("http://127.0.0.1:8545")).toBe(true);
    expect(isAllowedRpcUrl("http://rpc.example.org")).toBe(false);
    expect(isAllowedRpcUrl("ftp://rpc.example.org")).toBe(false);
    expect(isAllowedRpcUrl("not a url")).toBe(false);
  });
});
