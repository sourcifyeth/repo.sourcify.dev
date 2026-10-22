import { describe, expect, it } from "vitest";
import { findImportPaths, parseRemappings, resolveImportPath } from "./importResolution";
import { maskCommentsAndStrings } from "./sourceSymbols";

const paths = new Set([
  "src/SeaDrop.sol",
  "src/interfaces/ISeaDrop.sol",
  "src/lib/SeaDropStructs.sol",
  "lib/solmate/src/utils/SafeTransferLib.sol",
  "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol",
  "@openzeppelin/contracts/access/Ownable.sol",
  "contracts/extra/Vendor.sol",
]);
const remappings = parseRemappings([
  ":openzeppelin-contracts/=lib/openzeppelin-contracts/",
  ":solmate/=lib/solmate/src/",
  "src/:seadrop/=src/",
]);

describe("parseRemappings", () => {
  it("reads the context, prefix and target", () => {
    expect(parseRemappings(["ctx:a/=b/", "c/=d/", "bad"])).toEqual([
      { context: "ctx", prefix: "a/", target: "b/" },
      { context: "", prefix: "c/", target: "d/" },
    ]);
  });
});

describe("resolveImportPath", () => {
  it("resolves relative imports", () => {
    expect(resolveImportPath("./interfaces/ISeaDrop.sol", "src/SeaDrop.sol", paths)).toBe("src/interfaces/ISeaDrop.sol");
    expect(resolveImportPath("../lib/SeaDropStructs.sol", "src/interfaces/ISeaDrop.sol", paths)).toBe(
      "src/lib/SeaDropStructs.sol"
    );
  });

  it("applies remappings, and a context only to files under it", () => {
    expect(resolveImportPath("solmate/utils/SafeTransferLib.sol", "src/SeaDrop.sol", paths, remappings)).toBe(
      "lib/solmate/src/utils/SafeTransferLib.sol"
    );
    expect(
      resolveImportPath("openzeppelin-contracts/contracts/token/ERC721/IERC721.sol", "src/SeaDrop.sol", paths, remappings)
    ).toBe("lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol");
    expect(resolveImportPath("seadrop/SeaDrop.sol", "src/lib/SeaDropStructs.sol", paths, remappings)).toBe(
      "src/SeaDrop.sol"
    );
    expect(resolveImportPath("seadrop/SeaDrop.sol", "lib/other.sol", paths, remappings)).toBeUndefined();
  });

  it("uses the import path itself, then a unique path that ends with it", () => {
    expect(resolveImportPath("@openzeppelin/contracts/access/Ownable.sol", "src/SeaDrop.sol", paths)).toBe(
      "@openzeppelin/contracts/access/Ownable.sol"
    );
    expect(resolveImportPath("extra/Vendor.sol", "src/SeaDrop.sol", paths)).toBe("contracts/extra/Vendor.sol");
    expect(resolveImportPath("Missing.sol", "src/SeaDrop.sol", paths)).toBeUndefined();
  });
});

describe("findImportPaths", () => {
  it("finds the path text of each import form, and skips imports in comments", () => {
    const text = `import "./A.sol";
import {B, C} from './B.sol';
import * as D from "lib/D.sol";
// import "./Commented.sol";
import "./E.sol" as E;`;
    const found = findImportPaths(text, maskCommentsAndStrings(text, "solidity"));
    expect(found.map((f) => f.path)).toEqual(["./A.sol", "./B.sol", "lib/D.sol", "./E.sol"]);
    expect(text.slice(found[1].start, found[1].end)).toBe("./B.sol");
  });

  it("finds multi-line imports and skips the word import inside strings", () => {
    const text = `import {
  A,
  B
} from "./AB.sol";
string constant S = "import './Fake.sol'";`;
    const found = findImportPaths(text, maskCommentsAndStrings(text, "solidity"));
    expect(found.map((f) => f.path)).toEqual(["./AB.sol"]);
  });

  it("stays fast when a long run of spaces follows import (regression)", () => {
    const spaces = " ".repeat(500_000);
    const cases = [`// import${spaces}\nimport "./A.sol";`, `import${spaces};\nimport "./A.sol";`, `import${spaces}`];
    for (const text of cases) {
      const startedAt = performance.now();
      const found = findImportPaths(text, maskCommentsAndStrings(text, "solidity"));
      expect(performance.now() - startedAt).toBeLessThan(500);
      expect(found.map((f) => f.path)).toEqual(text.includes("./A.sol") ? ["./A.sol"] : []);
    }
  });
});
