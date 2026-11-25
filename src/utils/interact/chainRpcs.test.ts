import { describe, expect, it } from "vitest";
import {
  chainRpcs,
  indexChainlist,
  isAllowedRpcUrl,
  officialRpcs,
  pickDefaults,
  providerOf,
  usableRpcs,
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

  it("passes the official RPCs for wallets through, apart from the read defaults", () => {
    const result = chainRpcs(10, index.get(10), undefined, ["https://mainnet.optimism.io"]);
    expect(result.walletRpcs).toEqual(["https://mainnet.optimism.io"]);
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

describe("officialRpcs", () => {
  it("takes the first https URLs of the registry, without key placeholders, WebSockets or duplicates", () => {
    expect(
      officialRpcs({
        chainId: 1,
        rpc: [
          "https://mainnet.infura.io/v3/${INFURA_API_KEY}",
          "wss://mainnet.infura.io/ws/v3/${INFURA_API_KEY}",
          "https://api.mycryptoapi.com/eth",
          "http://insecure.example",
          "https://cloudflare-eth.com/",
          "https://cloudflare-eth.com",
          "not a url",
          42,
          "https://ethereum-rpc.publicnode.com",
          "https://fourth.example",
        ],
      })
    ).toEqual(["https://api.mycryptoapi.com/eth", "https://cloudflare-eth.com", "https://ethereum-rpc.publicnode.com"]);
  });

  it("gives nothing for a chain that is not in the registry, or that has no usable URL", () => {
    expect(officialRpcs(undefined)).toEqual([]);
    expect(officialRpcs({ chainId: 5, rpc: ["wss://only.example", "https://{API_KEY}.example"] })).toEqual([]);
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
