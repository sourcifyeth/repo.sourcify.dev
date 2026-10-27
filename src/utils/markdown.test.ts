import { describe, expect, it } from "vitest";
import { codeBlock, escapeMarkdown, inlineCode } from "./markdown";

describe("escapeMarkdown", () => {
  it("escapes every ASCII punctuation sign and leaves other text as it is", () => {
    expect(escapeMarkdown("[a](b) !*_`<>")).toBe("\\[a\\]\\(b\\) \\!\\*\\_\\`\\<\\>");
    expect(escapeMarkdown("plain text 123 äé")).toBe("plain text 123 äé");
  });
});

describe("inlineCode and codeBlock", () => {
  it("use a fence that the text cannot close", () => {
    expect(inlineCode("abc")).toBe("`abc`");
    expect(inlineCode("a`b")).toBe("``a`b``");
    expect(inlineCode("`a")).toBe("`` `a ``");
    expect(codeBlock("solidity", "x")).toBe("```solidity\nx\n```");
    expect(codeBlock("solidity", "a ``` b")).toBe("````solidity\na ``` b\n````");
  });
});
