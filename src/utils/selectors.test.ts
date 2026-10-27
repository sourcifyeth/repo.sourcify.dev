import { describe, expect, it } from "vitest";
import {
  canonicalSignature,
  canonicalType,
  findCompilerSignature,
  getterParameters,
  hashSignature,
  selectorOf,
  signatureParameters,
} from "./selectors";

const resolve = (name: string) => (name === "IERC20" ? "address" : name === "Status" ? "uint8" : undefined);

describe("canonicalType", () => {
  it("makes built-in types canonical", () => {
    expect(canonicalType("uint")).toBe("uint256");
    expect(canonicalType("int")).toBe("int256");
    expect(canonicalType("address payable")).toBe("address");
    expect(canonicalType("bytes32")).toBe("bytes32");
    expect(canonicalType("uint256[] ")).toBe("uint256[]");
    expect(canonicalType("uint [3][]")).toBe("uint256[3][]");
  });

  it("resolves contracts and enums, and gives up on other user types", () => {
    expect(canonicalType("IERC20", resolve)).toBe("address");
    expect(canonicalType("Lib.Status", resolve)).toBe("uint8");
    expect(canonicalType("MintParams", resolve)).toBeUndefined();
    expect(canonicalType("uint7")).toBeUndefined();
  });
});

describe("signatures and hashes", () => {
  it("builds canonical signatures", () => {
    expect(canonicalSignature("transfer", ["address", "uint"])).toBe("transfer(address,uint256)");
    expect(canonicalSignature("f", ["MintParams"], resolve)).toBeUndefined();
  });

  it("hashes like the compiler", () => {
    expect(selectorOf("transfer(address,uint256)")).toBe("0xa9059cbb");
    expect(hashSignature("Transfer(address,address,uint256)")).toBe(
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    );
  });

  it("splits signature parameters at top-level commas", () => {
    expect(signatureParameters("f(uint256,(address,bool),bytes[])")).toEqual({
      name: "f",
      types: ["uint256", "(address,bool)", "bytes[]"],
    });
    expect(signatureParameters("g()")).toEqual({ name: "g", types: [] });
  });
});

describe("findCompilerSignature", () => {
  const signatures = [
    { signature: "mint(address)", signatureHash4: "0x1", signatureHash32: "0x1" },
    { signature: "mint(address,uint256)", signatureHash4: "0x2", signatureHash32: "0x2" },
    { signature: "mint(address,bytes32)", signatureHash4: "0x3", signatureHash32: "0x3" },
    { signature: "mintSigned(address,(uint80,bool),bytes)", signatureHash4: "0x4", signatureHash32: "0x4" },
  ];

  it("matches by name and parameter count, then by known types", () => {
    expect(findCompilerSignature("mint", ["address"], signatures)?.signatureHash4).toBe("0x1");
    expect(findCompilerSignature("mint", ["address", "uint"], signatures)?.signatureHash4).toBe("0x2");
    expect(findCompilerSignature("mint", ["address", "bytes32"], signatures)?.signatureHash4).toBe("0x3");
  });

  it("matches a struct parameter by position when the name and count are unique", () => {
    expect(findCompilerSignature("mintSigned", ["address", "MintParams", "bytes"], signatures)?.signatureHash4).toBe(
      "0x4"
    );
    expect(findCompilerSignature("burn", [], signatures)).toBeUndefined();
  });
});

describe("getterParameters", () => {
  it("gives one parameter per mapping key and array dimension", () => {
    expect(getterParameters("uint256")).toEqual([]);
    expect(getterParameters("mapping(address => uint256)")).toEqual(["address"]);
    expect(getterParameters("mapping(address => mapping(uint256 => bool))")).toEqual(["address", "uint256"]);
    expect(getterParameters("mapping(address owner => uint256[] balances)")).toEqual(["address"]);
    expect(getterParameters("address[][2]")).toEqual(["uint256", "uint256"]);
  });
});
