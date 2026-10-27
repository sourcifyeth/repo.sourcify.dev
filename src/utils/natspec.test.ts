import { describe, expect, it } from "vitest";
import { docCommentAbove, natSpecFromCompiler, natSpecToMarkdown, parseNatSpec } from "./natspec";

describe("docCommentAbove", () => {
  const code = `contract A {
    /// @notice Mint tokens.
    /// @param to The receiver
    ///        of the tokens.
    function mint(address to) external {}

    /**
     * @dev Burns.
     * @return ok True on success.
     */
    function burn() external returns (bool ok) {}

    // not a doc comment
    function plain() external {}
}`;

  it("reads a run of /// lines", () => {
    expect(docCommentAbove(code, 5)).toBe("@notice Mint tokens.\n@param to The receiver\n       of the tokens.");
  });

  it("reads a /** */ block", () => {
    expect(docCommentAbove(code, 11)).toBe("@dev Burns.\n@return ok True on success.");
  });

  it("ignores ordinary comments and missing comments", () => {
    expect(docCommentAbove(code, 14)).toBeUndefined();
    expect(docCommentAbove(code, 1)).toBeUndefined();
  });
});

describe("parseNatSpec", () => {
  it("reads tags, joins continued lines, and treats untagged text as the notice", () => {
    expect(parseNatSpec("Mints.\n@param to The receiver\n   of the tokens.\n@custom:security low")).toEqual({
      notice: "Mints.",
      params: [{ name: "to", description: "The receiver of the tokens." }],
      returns: [],
      custom: [{ tag: "security", description: "low" }],
    });
  });

  it("returns undefined for an empty comment and keeps @inheritdoc", () => {
    expect(parseNatSpec("   ")).toBeUndefined();
    expect(parseNatSpec("@inheritdoc IERC20")?.inheritdoc).toBe("IERC20");
  });
});

describe("natSpecFromCompiler", () => {
  const userdoc = {
    methods: { "mint(address)": { notice: "Mint tokens." } },
    errors: { "Bad()": [{ notice: "Bad." }] },
  };
  const devdoc = {
    methods: { "mint(address)": { details: "Only owner.", params: { to: "Receiver" }, returns: { _0: "Amount" } } },
  };

  it("merges userdoc and devdoc for a key", () => {
    expect(natSpecFromCompiler(userdoc, devdoc, "methods", "mint(address)")).toEqual({
      notice: "Mint tokens.",
      dev: "Only owner.",
      params: [{ name: "to", description: "Receiver" }],
      returns: ["Amount"],
      custom: [],
    });
  });

  it("reads errors from their list, and gives undefined for unknown keys", () => {
    expect(natSpecFromCompiler(userdoc, devdoc, "errors", "Bad()")?.notice).toBe("Bad.");
    expect(natSpecFromCompiler(userdoc, devdoc, "methods", "nope()")).toBeUndefined();
  });
});

describe("natSpecToMarkdown", () => {
  it("renders the parts in order", () => {
    const markdown = natSpecToMarkdown({
      notice: "Mints.",
      dev: "Owner only.",
      params: [{ name: "to", description: "Receiver" }],
      returns: ["Amount"],
      custom: [],
    });
    expect(markdown).toBe("Mints\\.\n\n*Dev:* Owner only\\.\n\n- `to` Receiver\n\n- *Returns:* Amount");
  });

  it("escapes contract text, so images and links show as plain text", () => {
    const markdown = natSpecToMarkdown({
      notice: "![img](https://evil.example/x.png) [Claim](https://example.com/claim) <https://a.b> https://c.d",
      params: [{ name: "a`b", description: "**bold**" }],
      returns: [],
      custom: [],
    });
    // No unescaped Markdown syntax is left for links, images, autolinks or emphasis
    expect(markdown).not.toMatch(/(^|[^\\])!\[/);
    expect(markdown).not.toMatch(/(^|[^\\])\]\(/);
    expect(markdown).not.toMatch(/(^|[^\\])</);
    expect(markdown).not.toMatch(/https:\/\//);
    expect(markdown).toContain("``a`b``");
    expect(markdown).toContain("\\*\\*bold\\*\\*");
  });
});
