import { describe, expect, it } from "vitest";
import { countLines, hexByteLength, lineStats } from "./codeStats";

describe("hexByteLength", () => {
  it("counts bytes with or without 0x", () => {
    expect(hexByteLength("0x6080")).toBe(2);
    expect(hexByteLength("6080604052")).toBe(5);
    expect(hexByteLength("")).toBe(0);
    expect(hexByteLength(undefined)).toBe(0);
  });

  it("counts a library placeholder as 20 bytes", () => {
    expect(hexByteLength(`0x73__$1234567890abcdef1234567890abcdef12$__`)).toBe(21);
  });
});

describe("countLines", () => {
  it("does not count a final line break as a line", () => {
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("a")).toBe(1);
    expect(countLines("")).toBe(0);
  });
});

describe("lineStats", () => {
  const sources = {
    "src/Main.sol": { content: "a\nb\nc\n" },
    "lib/oz/Ownable.sol": { content: "x\ny\n" },
    "lib/Unused.sol": { content: "1\n2\n3\n4\n" },
  };
  const isLibrary = (path: string) => path.startsWith("lib/");

  it("splits own and library lines, and counts only compiled files", () => {
    const compiled = new Set(["src/Main.sol", "lib/oz/Ownable.sol"]);
    expect(lineStats(sources, isLibrary, "src/Main.sol", compiled)).toEqual({
      total: 5,
      library: 2,
      own: 3,
      files: { total: 2, library: 1, own: 1 },
    });
  });

  it("counts all files without a compiled list, and never treats the main file as library code", () => {
    expect(lineStats(sources, isLibrary, "lib/oz/Ownable.sol")).toEqual({
      total: 9,
      library: 4,
      own: 5,
      files: { total: 3, library: 1, own: 2 },
    });
  });
});
