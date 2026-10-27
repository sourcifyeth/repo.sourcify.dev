import { describe, expect, it } from "vitest";
import { createLibraryPathCheck, libraryRemappingPrefixes } from "./libraryFiles";

describe("createLibraryPathCheck", () => {
  const isLibrary = createLibraryPathCheck();

  it("marks npm packages, node_modules and Foundry lib folders", () => {
    expect(isLibrary("@openzeppelin/contracts/token/ERC20/ERC20.sol")).toBe(true);
    expect(isLibrary("node_modules/@uniswap/v3-core/contracts/libraries/FullMath.sol")).toBe(true);
    expect(isLibrary("project/node_modules/foo/Bar.sol")).toBe(true);
    expect(isLibrary("lib/solmate/src/tokens/ERC20.sol")).toBe(true);
    expect(isLibrary("contracts/@uniswap/v3-core/contracts/libraries/FullMath.sol")).toBe(true);
  });

  it("marks well-known library folders anywhere in the path", () => {
    expect(isLibrary("dependencies/openzeppelin-contracts/contracts/utils/Strings.sol")).toBe(true);
    expect(isLibrary("vendor/solady/src/utils/LibString.sol")).toBe(true);
  });

  it("does not mark the project's own code", () => {
    expect(isLibrary("src/SeaDrop.sol")).toBe(false);
    expect(isLibrary("src/lib/SeaDropStructs.sol")).toBe(false);
    expect(isLibrary("contracts/libraries/FullMath.sol")).toBe(false);
    expect(isLibrary("contracts/UniswapV3Factory.sol")).toBe(false);
  });

  it("ignores a leading ./ or /", () => {
    expect(isLibrary("./lib/forge-std/src/Test.sol")).toBe(true);
    expect(isLibrary("/lib/forge-std/src/Test.sol")).toBe(true);
  });

  it("marks paths under a remapping that points into library code", () => {
    const check = createLibraryPathCheck(["solmate/=lib/solmate/src/", "seadrop/=src/"]);
    expect(check("solmate/tokens/ERC20.sol")).toBe(true);
    expect(check("seadrop/SeaDrop.sol")).toBe(false);
  });
});

describe("libraryRemappingPrefixes", () => {
  it("reads remappings with and without a context, and keeps only library targets", () => {
    expect(
      libraryRemappingPrefixes([
        ":ERC721A/=lib/ERC721A/contracts/",
        "src/:utility/=node_modules/utility/",
        ":seadrop/=src/",
        "broken-remapping",
      ])
    ).toEqual(["ERC721A/", "utility/"]);
  });
});
