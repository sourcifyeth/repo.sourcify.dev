import { defaultAbiCoder } from "@ethersproject/abi";
import { beforeEach, describe, expect, it } from "vitest";
import { buildFunctions } from "./abi";
import { readFunction } from "./read";
import { clearBlockCache } from "./rpcRead";
import type { CallContext, RpcEndpoint } from "./types";

const endpoint = (url: string): RpcEndpoint => ({
  id: url,
  url,
  host: new URL(url).host,
  tracking: "none",
  kind: "public",
});
const A = endpoint("https://a.example.com");
const B = endpoint("https://b.example.org");
const ctx: CallContext = {
  chainId: "1",
  chainName: "Ethereum",
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  contractName: "FiatTokenProxy",
  errorAbi: [{ type: "error", name: "Paused", inputs: [] }],
};
const [balanceOf] = buildFunctions(
  [
    {
      type: "function",
      name: "balanceOf",
      inputs: [{ name: "a", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
    },
  ],
  {},
  "own"
);
const owner = "0x55FE002aefF02F77364de339a1292923A15844B8";

/** Two fake nodes; `answers` gives each node's reply to eth_call. */
function network(answers: Record<string, object>) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { id, method } = JSON.parse(String(init?.body));
    const body = method === "eth_blockNumber" ? { result: "0x10" } : answers[String(input)];
    return new Response(JSON.stringify({ jsonrpc: "2.0", id, ...body }));
  }) as typeof fetch;
}

beforeEach(() => clearBlockCache());

describe("readFunction", () => {
  it("decodes an answer on which both endpoints agree", async () => {
    const result = { result: defaultAbiCoder.encode(["uint256"], ["174831070000"]) };
    const outcome = await readFunction(balanceOf, [owner], ctx, [A, B], undefined, {
      fetchImpl: network({ [A.url]: result, [B.url]: result }),
    });
    expect(outcome).toMatchObject({ status: "success", check: "agree", block: 16, values: ["174831070000"] });
    if (outcome.status !== "success") throw new Error("unexpected");
    expect(outcome.sources.map((source) => source.endpoint.host)).toEqual(["a.example.com", "b.example.org"]);
  });

  it("explains a revert with the contract's errors", async () => {
    const revert = { error: { code: 3, message: "execution reverted", data: "0x9e87fac8" } }; // Paused()
    const outcome = await readFunction(balanceOf, [owner], ctx, [A, B], undefined, {
      fetchImpl: network({ [A.url]: revert, [B.url]: revert }),
    });
    expect(outcome).toMatchObject({ status: "error", block: 16, error: { kind: "custom-error", name: "Paused" } });
  });

  it("shows both sides of a mismatch", async () => {
    const outcome = await readFunction(balanceOf, [owner], ctx, [A, B], undefined, {
      fetchImpl: network({
        [A.url]: { result: defaultAbiCoder.encode(["uint256"], ["1"]) },
        [B.url]: { error: { code: 3, message: "execution reverted", data: "0x" } },
      }),
    });
    expect(outcome).toMatchObject({
      status: "success",
      check: "mismatch",
      sides: [
        { host: "a.example.com", values: ["1"] },
        { host: "b.example.org", error: { kind: "unknown-revert" } },
      ],
    });
  });

  it("reports empty data from an address without a contract", async () => {
    const outcome = await readFunction(balanceOf, [owner], ctx, [A, B], undefined, {
      fetchImpl: network({ [A.url]: { result: "0x" }, [B.url]: { result: "0x" } }),
    });
    expect(outcome).toMatchObject({ status: "error", error: { kind: "bad-result", raw: "0x" } });
  });

  it("sends the wallet address as the sender", async () => {
    const bodies: Array<{ method: string; params: unknown[] }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      const result = body.method === "eth_blockNumber" ? "0x10" : defaultAbiCoder.encode(["uint256"], ["5"]);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    }) as typeof fetch;
    await readFunction(balanceOf, [owner], ctx, [A], owner, { fetchImpl });
    expect(bodies.find((body) => body.method === "eth_call")?.params[0]).toMatchObject({
      from: owner,
      to: ctx.address,
    });
  });
});

describe("readFunction: different newest blocks", () => {
  it("names the hosts of the gap, keeps each newest block, and sends no sender unless one is given", async () => {
    const encoded = defaultAbiCoder.encode(["uint256"], [7]);
    const bodies: Array<{ method: string; params: unknown[] }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const { id, method, params } = JSON.parse(String(init?.body));
      bodies.push({ method, params });
      const ahead = String(input) === A.url;
      const body =
        method === "eth_blockNumber"
          ? { result: ahead ? "0x20" : "0x10" }
          : method === "eth_getBlockByNumber"
            ? { result: { timestamp: `0x${(1_000).toString(16)}` } }
            : { result: encoded };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id, ...body }));
    }) as typeof fetch;
    const outcome = await readFunction(balanceOf, [owner], ctx, [A, B], undefined, {
      fetchImpl,
      now: () => 1_300_000,
    });
    expect(outcome.status).toBe("success");
    if (outcome.status !== "success") return;
    expect(outcome.block).toBe(16);
    expect(outcome.sources.map((source) => source.head)).toEqual([32, 16]);
    expect(outcome.gap).toEqual({
      behind: "b.example.org",
      ahead: "a.example.com",
      behindHead: 16,
      aheadHead: 32,
      blocks: 16,
      ageSeconds: 300,
      large: true,
    });
    const call = bodies.find((body) => body.method === "eth_call");
    expect(call?.params[0]).not.toHaveProperty("from");
  });
});
