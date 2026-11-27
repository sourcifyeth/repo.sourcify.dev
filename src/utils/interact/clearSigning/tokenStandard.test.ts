import { describe, expect, it } from "vitest";
import { ABIS, functionsOf } from "./fixtures";
import { ERC20_SELECTORS, ERC721_SELECTORS, detectTokenStandard } from "./tokenStandard";

describe("detectTokenStandard", () => {
  it("finds ERC-20 from the six required functions, whatever the argument names are", () => {
    const selectors = functionsOf(ABIS.token).map((fn) => fn.selector);
    expect(detectTokenStandard(selectors)).toBe("erc20");
    expect(detectTokenStandard(ERC20_SELECTORS.map((selector) => selector.toUpperCase().replace("0X", "0x")))).toBe(
      "erc20"
    );
  });

  it("needs all six ERC-20 functions", () => {
    for (const missing of ERC20_SELECTORS) {
      expect(detectTokenStandard(ERC20_SELECTORS.filter((selector) => selector !== missing))).toBeNull();
    }
  });

  it("does not take an ABI with ownerOf as ERC-20", () => {
    expect(detectTokenStandard([...ERC20_SELECTORS, "0x6352211e"])).toBeNull();
  });

  it("finds ERC-721", () => {
    // approve and transferFrom of ERC-721 have the selectors of ERC-20
    expect(detectTokenStandard([...ERC721_SELECTORS, "0x095ea7b3", "0x23b872dd"])).toBe("erc721");
    expect(detectTokenStandard(ERC721_SELECTORS.slice(1))).toBeNull();
  });

  it("gives no template to an ABI with both full sets", () => {
    expect(detectTokenStandard([...ERC20_SELECTORS, ...ERC721_SELECTORS])).toBeNull();
  });

  it("finds nothing in other ABIs", () => {
    expect(detectTokenStandard([])).toBeNull();
    expect(detectTokenStandard(functionsOf(ABIS.router).map((fn) => fn.selector))).toBeNull();
  });
});
