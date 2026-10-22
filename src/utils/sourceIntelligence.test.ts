import { describe, expect, it } from "vitest";
import { parse } from "@solidity-parser/parser";
import { extractSymbols, FileSymbols } from "./sourceSymbols";
import {
  declarationLine,
  findSymbolByPath,
  inheritanceChain,
  natSpecInfo,
  rankCandidates,
  selectorInfo,
  symbolEntries,
  userTypeResolver,
} from "./sourceIntelligence";

const files: Record<string, string> = {
  "src/Token.sol": `pragma solidity ^0.8.0;
import "./IToken.sol";
import "./Base.sol";
contract Token is Base, IToken {
    enum Status { Off, On }
    struct Order { uint256 a; }
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    /// @notice Moves tokens.
    /// @param to The receiver.
    function transfer(address to, uint256 amount) external returns (bool) { return true; }
    function setStatus(Status s, IToken other) external {}
    function place(Order calldata order) external {}
    function _move(address to) internal {}
    event Moved(address indexed to);
    error Denied(address who);
}`,
  "src/IToken.sol": `pragma solidity ^0.8.0;
interface IToken {
    /// @notice Interface docs for transfer.
    function transfer(address to, uint256 amount) external returns (bool);
}`,
  "src/Base.sol": `pragma solidity ^0.8.0;
abstract contract Base {
    /// @inheritdoc IToken
    function transfer(address to, uint256 amount) external virtual returns (bool) {}
    function _move(address to) internal {}
}
library Lib { function helper(uint256 a) external pure returns (uint256) {} }`,
};

const fileMap = new Map<string, FileSymbols>(
  Object.entries(files).map(([path, content]) => [path, extractSymbols(content, "solidity", parse)])
);
const entries = symbolEntries(fileMap);
const resolve = userTypeResolver(entries);
const chain = inheritanceChain(entries, "Token");
const find = (path: string, name: string) => entries.find((e) => e.path === path && e.symbol.name === name)!;

const compiler = {
  targetContract: "Token",
  signatures: {
    function: [
      { signature: "transfer(address,uint256)", signatureHash4: "0xa9059cbb", signatureHash32: "0x" },
      { signature: "place((uint256))", signatureHash4: "0x11111111", signatureHash32: "0x" },
    ],
    event: [],
    error: [],
  },
  userdoc: { methods: { "transfer(address,uint256)": { notice: "Compiler notice." } } },
  devdoc: { methods: { "transfer(address,uint256)": { params: { amount: "How much.", to: "Who." } } } },
};

describe("inheritanceChain and rankCandidates", () => {
  it("lists the main contract and its bases, nearest first", () => {
    expect(chain).toEqual(["Token", "Base", "IToken"]);
  });

  it("ranks implementations in the chain before interface declarations", () => {
    const ranked = rankCandidates(entries, "transfer", "src/IToken.sol", chain);
    expect(ranked.map((e) => `${e.path}:${e.container?.name}`)).toEqual([
      "src/Token.sol:Token",
      "src/Base.sol:Base",
      "src/IToken.sol:IToken",
    ]);
  });
});

describe("selectorInfo", () => {
  it("uses the compiler signature in the chain, including struct parameters", () => {
    expect(selectorInfo(find("src/Token.sol", "transfer"), compiler, resolve, chain)).toMatchObject({
      kind: "selector",
      value: "0xa9059cbb",
      fromCompiler: true,
    });
    expect(selectorInfo(find("src/Token.sol", "place"), compiler, resolve, chain)?.value).toBe("0x11111111");
  });

  it("computes selectors with enum and contract parameters, and topics for events", () => {
    expect(selectorInfo(find("src/Token.sol", "setStatus"), compiler, resolve, chain)).toMatchObject({
      signature: "setStatus(uint8,address)",
      fromCompiler: false,
    });
    const moved = selectorInfo(find("src/Token.sol", "Moved"), compiler, resolve, chain)!;
    expect(moved.kind).toBe("topic");
    expect(moved.value).toHaveLength(66);
    expect(selectorInfo(find("src/Token.sol", "Denied"), compiler, resolve, chain)?.signature).toBe("Denied(address)");
  });

  it("gives getters of public state variables their parameters", () => {
    expect(selectorInfo(find("src/Token.sol", "balanceOf"), compiler, resolve, chain)?.signature).toBe("balanceOf(address)");
    expect(selectorInfo(find("src/Token.sol", "totalSupply"), compiler, resolve, chain)?.value).toBe("0x18160ddd");
  });

  it("has no selector for internal functions, library functions, or unknown struct types outside the chain", () => {
    expect(selectorInfo(find("src/Token.sol", "_move"), compiler, resolve, chain)).toBeUndefined();
    expect(selectorInfo(find("src/Base.sol", "helper"), compiler, resolve, chain)).toBeUndefined();
  });
});

describe("natSpecInfo", () => {
  const read = (path: string) => files[path];

  it("uses the compiler's docs for the main contract", () => {
    const entry = find("src/Token.sol", "transfer");
    const selector = selectorInfo(entry, compiler, resolve, chain);
    const spec = natSpecInfo(entry, files[entry.path], compiler, selector, entries, read);
    expect(spec?.notice).toBe("Compiler notice.");
    // Declaration order (to, amount), not the compiler's key order
    expect(spec?.params.map((p) => p.name)).toEqual(["to", "amount"]);
  });

  it("reads the comment above other declarations, and follows @inheritdoc", () => {
    const entry = find("src/Base.sol", "transfer");
    expect(natSpecInfo(entry, files[entry.path], compiler, undefined, entries, read)?.notice).toBe(
      "Interface docs for transfer."
    );
  });
});

describe("declarationLine and findSymbolByPath", () => {
  it("writes a one-line declaration", () => {
    expect(declarationLine(find("src/Token.sol", "transfer").symbol)).toBe("function transfer(address, uint256) external");
    expect(declarationLine(find("src/Token.sol", "balanceOf").symbol)).toBe("mapping(address => uint256) public balanceOf");
    expect(declarationLine(find("src/Token.sol", "Token").symbol)).toBe("contract Token is Base, IToken");
  });

  it("finds Contract.member and plain names", () => {
    expect(findSymbolByPath(fileMap.get("src/Token.sol")!, "Token.balanceOf")?.kind).toBe("stateVariable");
    expect(findSymbolByPath(fileMap.get("src/Base.sol")!, "Lib")?.kind).toBe("library");
    expect(findSymbolByPath(fileMap.get("src/Token.sol")!, "Token.missing")).toBeUndefined();
  });
});
