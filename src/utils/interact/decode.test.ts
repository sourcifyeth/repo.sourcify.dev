import { defaultAbiCoder } from "@ethersproject/abi";
import { describe, expect, it } from "vitest";
import { buildFunctions } from "./abi";
import { decodeOutputs, decodeRevert } from "./decode";

const enc = (types: string[], values: unknown[]) => defaultAbiCoder.encode(types, values);

describe("decodeOutputs", () => {
  it("decodes one value, several values, and a named struct", () => {
    const [one, several, struct] = buildFunctions(
      [
        {
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "pair",
          inputs: [],
          outputs: [
            { name: "ok", type: "bool" },
            { name: "who", type: "address" },
          ],
          stateMutability: "view",
        },
        {
          type: "function",
          name: "data",
          inputs: [],
          outputs: [
            {
              name: "res",
              type: "tuple",
              components: [
                { name: "id", type: "uint16" },
                { name: "tags", type: "bytes4[]" },
              ],
            },
          ],
          stateMutability: "view",
        },
      ],
      {},
      "own"
    );
    expect(decodeOutputs(one, enc(["uint256"], ["174831070000"]))).toEqual(["174831070000"]);
    const who = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    expect(decodeOutputs(several, enc(["bool", "address"], [true, who]))).toEqual([true, who]);
    expect(decodeOutputs(struct, enc(["tuple(uint16,bytes4[])"], [[36, ["0x01020304"]]]))).toEqual([
      ["36", ["0x01020304"]],
    ]);
  });

  it("throws when the data does not fit the outputs", () => {
    const [fn] = buildFunctions(
      [{ type: "function", name: "x", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" }],
      {},
      "own"
    );
    expect(() => decodeOutputs(fn, "0x")).toThrow();
  });
});

describe("decodeRevert", () => {
  const errorAbi = [
    {
      type: "error",
      name: "InsufficientBalance",
      inputs: [
        { name: "available", type: "uint256" },
        { name: "required", type: "uint256" },
      ],
    },
  ];

  it("decodes Error(string)", () => {
    const data = "0x08c379a0" + enc(["string"], ["ERC20: transfer amount exceeds balance"]).slice(2);
    expect(decodeRevert(data, [])).toEqual({
      kind: "revert-string",
      reason: "ERC20: transfer amount exceeds balance",
      raw: data,
    });
  });

  it("decodes Panic(uint256) and says what the code means", () => {
    const data = "0x4e487b71" + enc(["uint256"], [0x11]).slice(2);
    expect(decodeRevert(data, [])).toMatchObject({
      kind: "panic",
      code: "0x11",
      meaning: "an arithmetic overflow or underflow",
    });
  });

  it("decodes a custom error from the contract ABI", () => {
    const selector = "0xcf479181"; // keccak256("InsufficientBalance(uint256,uint256)")
    const data = selector + enc(["uint256", "uint256"], [250000000, 1000000000]).slice(2);
    expect(decodeRevert(data, errorAbi)).toEqual({
      kind: "custom-error",
      name: "InsufficientBalance",
      selector,
      args: [
        { name: "available", type: "uint256", value: "250000000" },
        { name: "required", type: "uint256", value: "1000000000" },
      ],
      raw: data,
    });
  });

  it("keeps unknown data and empty data raw", () => {
    expect(decodeRevert("0x12345678", errorAbi)).toEqual({ kind: "unknown-revert", raw: "0x12345678" });
    expect(decodeRevert("0x", errorAbi)).toEqual({ kind: "unknown-revert", raw: "0x" });
  });
});
