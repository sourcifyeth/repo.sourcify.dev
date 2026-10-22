import { describe, expect, it } from "vitest";
import { parse } from "@solidity-parser/parser";
import {
  extractSymbols,
  flattenSymbols,
  languageOfPath,
  maskCommentsAndStrings,
  regexSoliditySymbols,
  regexVyperSymbols,
  symbolsAtLine,
} from "./sourceSymbols";

const solidity = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

uint256 constant LIMIT = 10;
error Unauthorized(address caller);

/// @notice A token
abstract contract Token is Base, IERC20 {
    mapping(address => uint256) private _balances;
    address public immutable owner;

    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyOwner() {
        _;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    function transfer(address to, uint256 amount) external payable returns (bool) {
        return true;
    }

    receive() external payable {}
}

interface IThing {
    function thing() external view returns (uint256);
}
`;

describe("extractSymbols with the parser", () => {
  const { symbols, method } = extractSymbols(solidity, "solidity", parse);

  it("uses the parser and keeps the file order", () => {
    expect(method).toBe("parser");
    expect(symbols.map((s) => `${s.kind}:${s.name}`)).toEqual([
      "constant:LIMIT",
      "error:Unauthorized",
      "abstractContract:Token",
      "interface:IThing",
    ]);
  });

  it("lists the members of a contract with details", () => {
    const token = symbols[2];
    expect(token.detail).toBe("is Base, IERC20");
    expect(token.children?.map((s) => `${s.kind}:${s.name}`)).toEqual([
      "stateVariable:_balances",
      "stateVariable:owner",
      "event:Transfer",
      "modifier:onlyOwner",
      "constructor:constructor",
      "function:transfer",
      "receive:receive",
    ]);
    const transfer = token.children!.find((s) => s.name === "transfer")!;
    expect(transfer).toMatchObject({ detail: "(address, uint256)", visibility: "external", mutability: "payable" });
    expect(token.children!.find((s) => s.name === "owner")).toMatchObject({
      detail: "address",
      visibility: "public",
      mutability: "immutable",
    });
  });

  it("gives Monaco positions for the declaration and the name", () => {
    const transfer = symbols[2].children!.find((s) => s.name === "transfer")!;
    // "    function transfer(" is line 22; "transfer" starts at column 14
    expect(transfer.nameRange).toEqual({ startLine: 22, startColumn: 14, endLine: 22, endColumn: 22 });
    expect(transfer.range.startLine).toBe(22);
    expect(transfer.range.endLine).toBe(24);
    expect(symbols[2].range).toMatchObject({ startLine: 8, endLine: 27 });
  });

  it("falls back to the regex scan when the parser fails", () => {
    const { method, symbols: fallback } = extractSymbols("contract A { function f( {", "solidity", parse);
    expect(method).toBe("regex");
    expect(fallback[0].name).toBe("A");
  });

  it("finds no symbols in other languages", () => {
    expect(extractSymbols("fn main() {}", "other", parse)).toEqual({ symbols: [], method: "none" });
  });
});

describe("regexSoliditySymbols", () => {
  it("finds containers and members, and ignores comments and strings", () => {
    const code = `// contract Fake {}
contract A {
  string s = "function notReal() {}";
  /* event Hidden(); */
  function f(uint a) external {}
  event E(uint a);
}
function free() pure {}
`;
    const symbols = regexSoliditySymbols(code);
    expect(symbols.map((s) => `${s.kind}:${s.name}`)).toEqual(["contract:A", "function:free"]);
    expect(symbols[0].children?.map((s) => `${s.kind}:${s.name}`)).toEqual(["function:f", "event:E"]);
    expect(symbols[0].range).toMatchObject({ startLine: 2, endLine: 7 });
  });
});

describe("regexVyperSymbols", () => {
  const vyper = `# @version 0.3.10
"""
@title A pool
def notAFunction():
"""
from vyper.interfaces import ERC20

event TokenExchange:
    buyer: indexed(address)
    sold_id: int128

struct Point:
    x: uint256

owner: public(address)
N_COINS: constant(uint256) = 3
balances: HashMap[address, uint256]

@external
def __init__(_owner: address):
    self.owner = _owner

@view
@external
def get_dy(i: int128, j: int128, dx: uint256) -> uint256:
    return 0
`;
  const symbols = regexVyperSymbols(vyper);

  it("finds events, structs, state variables and functions, not text in docstrings", () => {
    expect(symbols.map((s) => `${s.kind}:${s.name}`)).toEqual([
      "event:TokenExchange",
      "struct:Point",
      "stateVariable:owner",
      "constant:N_COINS",
      "stateVariable:balances",
      "constructor:__init__",
      "function:get_dy",
    ]);
  });

  it("reads decorators, parameter types and variable types", () => {
    const getDy = symbols.find((s) => s.name === "get_dy")!;
    expect(getDy).toMatchObject({ visibility: "external", mutability: "view", detail: "(int128, int128, uint256)" });
    expect(symbols.find((s) => s.name === "owner")).toMatchObject({ visibility: "public", detail: "address" });
    expect(symbols.find((s) => s.name === "N_COINS")).toMatchObject({ mutability: "constant", detail: "uint256" });
  });

  it("ends a block at the next line at column 0", () => {
    expect(symbols.find((s) => s.name === "TokenExchange")!.range).toMatchObject({ startLine: 8, endLine: 10 });
  });
});

describe("helpers", () => {
  it("maps file extensions to languages", () => {
    expect(languageOfPath("a/B.sol")).toBe("solidity");
    expect(languageOfPath("pool.vy")).toBe("vyper");
    expect(languageOfPath("x.fe")).toBe("other");
  });

  it("masks comments and strings without moving offsets", () => {
    const text = 'a // b\nc "d" /* e\nf */ g';
    const masked = maskCommentsAndStrings(text, "solidity");
    expect(masked.length).toBe(text.length);
    expect(masked).toBe('a     \nc " "     \n     g');
  });

  it("flattens symbols with their container, and finds the symbols at a line", () => {
    const { symbols } = extractSymbols(solidity, "solidity", parse);
    const flat = flattenSymbols(symbols);
    expect(flat.find((f) => f.symbol.name === "transfer")?.container).toBe("Token");
    expect(symbolsAtLine(symbols, 23).map((s) => s.name)).toEqual(["Token", "transfer"]);
    expect(symbolsAtLine(symbols, 2)).toEqual([]);
  });
});
