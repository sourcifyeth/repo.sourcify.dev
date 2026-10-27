import { describe, expect, it } from "vitest";
import { buildSearchRegExp, findMatchesInText, searchSources, SearchOptions } from "./sourceSearch";

const options = (query: string, overrides: Partial<SearchOptions> = {}): SearchOptions => ({
  query,
  matchCase: false,
  wholeWord: false,
  regex: false,
  ...overrides,
});

function regExpFor(query: string, overrides: Partial<SearchOptions> = {}): RegExp {
  const result = buildSearchRegExp(options(query, overrides));
  if (!(result instanceof RegExp)) throw new Error("expected a RegExp");
  return result;
}

describe("buildSearchRegExp", () => {
  it("returns null for an empty query", () => {
    expect(buildSearchRegExp(options(""))).toBeNull();
  });

  it("escapes special characters when regex is off", () => {
    const regExp = regExpFor("a.b(");
    expect(regExp.test("xa.b(y")).toBe(true);
    expect(regExpFor("a.b(").test("axb(")).toBe(false);
  });

  it("returns a short error for an invalid regular expression, without the pattern", () => {
    const result = buildSearchRegExp(options("a(", { regex: true }));
    expect(result).toEqual({ error: expect.stringMatching(/^Invalid regular expression/) });
    expect((result as { error: string }).error).not.toContain("/a(/");
  });

  it("is case-insensitive unless match case is on", () => {
    expect(regExpFor("owner").test("Owner")).toBe(true);
    expect(regExpFor("owner", { matchCase: true }).test("Owner")).toBe(false);
  });
});

describe("findMatchesInText", () => {
  const text = "contract A {\n  uint owner;\n  function setOwner() {}\n}\n";

  it("returns 1-based lines and columns, and the line text", () => {
    expect(findMatchesInText(text, regExpFor("owner"))).toEqual([
      { startLine: 2, startColumn: 8, endLine: 2, endColumn: 13, lineText: "  uint owner;" },
      { startLine: 3, startColumn: 15, endLine: 3, endColumn: 20, lineText: "  function setOwner() {}" },
    ]);
  });

  it("whole word skips matches inside identifiers, including $ and _", () => {
    expect(findMatchesInText(text, regExpFor("owner", { wholeWord: true }))).toHaveLength(1);
    expect(findMatchesInText("a$owner _owner owner", regExpFor("owner", { wholeWord: true }))).toHaveLength(1);
  });

  it("supports a regular expression with ^ per line", () => {
    const matches = findMatchesInText(text, regExpFor("^\\s+function", { regex: true }));
    expect(matches.map((m) => m.startLine)).toEqual([3]);
  });

  it("skips empty matches", () => {
    expect(findMatchesInText("abc", regExpFor("x*", { regex: true }))).toEqual([]);
  });

  it("reports the end of a match that spans lines", () => {
    const [match] = findMatchesInText("ab\ncd", regExpFor("b\\nc", { regex: true }));
    expect(match).toMatchObject({ startLine: 1, startColumn: 2, endLine: 2, endColumn: 2, lineText: "ab" });
  });

  it("drops a trailing carriage return from the line text", () => {
    const [match] = findMatchesInText("x = 1;\r\ny", regExpFor("x"));
    expect(match.lineText).toBe("x = 1;");
  });

  it("stops at the limit", () => {
    expect(findMatchesInText("a a a a", regExpFor("a"), 2)).toHaveLength(2);
  });
});

describe("searchSources", () => {
  const sources = {
    "lib/b.sol": { content: "owner\nowner" },
    "src/Main.sol": { content: "owner" },
    "a.sol": { content: "nothing here" },
  };

  it("puts the first path first, then sorts by path, and skips files without matches", () => {
    const result = searchSources(sources, regExpFor("owner"), { firstPath: "src/Main.sol" });
    expect(result.files.map((f) => f.path)).toEqual(["src/Main.sol", "lib/b.sol"]);
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("stops at the result limit and says so", () => {
    const result = searchSources(sources, regExpFor("owner"), { maxResults: 2, firstPath: "src/Main.sol" });
    expect(result.total).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.files.map((f) => [f.path, f.matches.length])).toEqual([
      ["src/Main.sol", 1],
      ["lib/b.sol", 1],
    ]);
  });

  it("is not truncated when the results fill the limit exactly", () => {
    const result = searchSources(sources, regExpFor("owner"), { maxResults: 3 });
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(false);
  });
});
