import { describe, expect, it } from "vitest";
import { FileNode } from "@/types/codeEditor";
import { buildFileTreeWithIds, OTHER_FILES_GROUP_ID } from "./fileExplorer";

const sources = {
  "src/Main.sol": { content: "main" },
  "lib/solmate/src/ERC20.sol": { content: "erc20" },
  "lib/solmate/src/utils/Safe.sol": { content: "safe" },
  "src/Unused.sol": { content: "unused" },
};
const fqn = "src/Main.sol:Main";

const names = (nodes: FileNode[]) => nodes.map((n) => n.name);
const childrenOf = (node: FileNode) => node.children as FileNode[];

describe("buildFileTreeWithIds", () => {
  it("builds folders, marks the target file, and keeps exact file ids", () => {
    const tree = buildFileTreeWithIds({ "/abs/A.sol": { content: "a" } }, "/abs/A.sol:A");
    const file = childrenOf(tree[0])[0];
    expect(file).toMatchObject({ id: "/abs/A.sol", path: "/abs/A.sol", isTarget: true, type: "file" });
  });

  it("puts files that are not compiled into the Other files group, with unique folder ids", () => {
    const compiledPaths = new Set(["src/Main.sol", "lib/solmate/src/ERC20.sol", "lib/solmate/src/utils/Safe.sol"]);
    const tree = buildFileTreeWithIds(sources, fqn, { compiledPaths });
    expect(names(tree)).toEqual(["src", "lib", "Other files"]);
    const group = tree[2];
    expect(group).toMatchObject({ id: OTHER_FILES_GROUP_ID, isOtherGroup: true, fileCount: 1 });
    const otherSrc = childrenOf(group)[0];
    expect(otherSrc.id).toBe(`${OTHER_FILES_GROUP_ID}/src`);
    expect(childrenOf(otherSrc)[0].id).toBe("src/Unused.sol");
    expect(names(childrenOf(tree[0]))).toEqual(["Main.sol"]);
  });

  it("has no group without a list of compiled files, or when every file is compiled", () => {
    expect(names(buildFileTreeWithIds(sources, fqn))).toEqual(["src", "lib"]);
    expect(names(buildFileTreeWithIds(sources, fqn, { compiledPaths: new Set(Object.keys(sources)) }))).toEqual([
      "src",
      "lib",
    ]);
  });

  it("marks library files, and folders whose files are all library files", () => {
    const tree = buildFileTreeWithIds(sources, fqn, { isLibrary: (path) => path.startsWith("lib/") });
    const [src, lib] = tree;
    expect(src.isLibrary).toBe(false);
    expect(lib.isLibrary).toBe(true);
    expect(lib.fileCount).toBe(2);
    expect(childrenOf(childrenOf(lib)[0])[0]).toMatchObject({ name: "src", isLibrary: true });
  });
});
