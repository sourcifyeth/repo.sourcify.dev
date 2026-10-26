import { describe, expect, it } from "vitest";
import { formatSourceHash, parseSourceHash } from "./sourceHash";

describe("parseSourceHash", () => {
  it("returns null for an empty hash or an anchor without a source location", () => {
    expect(parseSourceHash("")).toBeNull();
    expect(parseSourceHash("#")).toBeNull();
    expect(parseSourceHash("#abi")).toBeNull();
    expect(parseSourceHash("#L=10")).toBeNull();
  });

  it("reads the file and a single line", () => {
    expect(parseSourceHash("#file=contracts/Token.sol&L=10")).toEqual({
      file: "contracts/Token.sol",
      lines: { start: 10, end: 10 },
    });
  });

  it("reads a line range and orders it", () => {
    expect(parseSourceHash("file=a.sol&L=20-10")?.lines).toEqual({ start: 10, end: 20 });
  });

  it("ignores a malformed or zero line range", () => {
    expect(parseSourceHash("#file=a.sol&L=abc")?.lines).toBeUndefined();
    expect(parseSourceHash("#file=a.sol&L=0")?.lines).toBeUndefined();
  });

  it("decodes encoded path characters", () => {
    expect(parseSourceHash("#file=%40openzeppelin/contracts/token%20v2.sol")?.file).toBe(
      "@openzeppelin/contracts/token v2.sol"
    );
  });

  it("keeps a plus sign in a path", () => {
    const hash = formatSourceHash({ file: "lib/a+b.sol" });
    expect(parseSourceHash(hash)?.file).toBe("lib/a+b.sol");
  });

  it("reads a byte range and a symbol", () => {
    expect(parseSourceHash("#file=a.sol&R=100-250&sym=transfer(address,uint256)")).toEqual({
      file: "a.sol",
      range: { start: 100, end: 250 },
      symbol: "transfer(address,uint256)",
    });
  });
});

describe("formatSourceHash", () => {
  it("keeps slashes, @ and : readable and encodes the rest", () => {
    expect(formatSourceHash({ file: "@openzeppelin/contracts/a b.sol" })).toBe(
      "#file=@openzeppelin/contracts/a%20b.sol"
    );
    expect(formatSourceHash({ file: "weird&name=1#.sol" })).toBe("#file=weird%26name%3D1%23.sol");
  });

  it("writes a single line as one number and a range with a dash", () => {
    expect(formatSourceHash({ file: "a.sol", lines: { start: 5, end: 5 } })).toBe("#file=a.sol&L=5");
    expect(formatSourceHash({ file: "a.sol", lines: { start: 5, end: 9 } })).toBe("#file=a.sol&L=5-9");
  });

  it("returns an empty string for an empty location", () => {
    expect(formatSourceHash({})).toBe("");
  });

  it("round-trips through parseSourceHash", () => {
    const location = {
      file: "/lib/solmate/src/tokens/ERC20.sol",
      lines: { start: 3, end: 40 },
      range: { start: 10, end: 20 },
      symbol: "balanceOf(address)",
    };
    expect(parseSourceHash(formatSourceHash(location))).toEqual(location);
  });
});
