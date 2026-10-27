import { FileNode } from "@/types/codeEditor";
import { SourceData } from "@/types/contract";

/** The id of the group node for files that the compiled contract does not use. */
export const OTHER_FILES_GROUP_ID = "__other-files__";

interface BuildFileTreeOptions {
  // Paths of the files that the compiled contract uses (the keys of `sourceIds`).
  // Other files go into the "Other files" group. Without it, there is no group.
  compiledPaths?: Set<string>;
  isLibrary?: (path: string) => boolean;
}

// Builds a folder tree from flat paths. `idPrefix` keeps folder ids unique when
// the same folder name shows both in the main tree and in the "Other files" group.
function buildTree(
  entries: Array<[string, SourceData]>,
  targetPath: string,
  isLibrary: (path: string) => boolean,
  idPrefix: string
): FileNode[] {
  const root: Record<string, FileNode> = {};

  entries.forEach(([filePath, fileData]) => {
    const parts = filePath.split("/").filter((part) => part !== "");
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // A file node keeps the exact source key as its id and path. Thus lookups
      // in `sources`, the target check and the tree selection also work for keys
      // that start with "/" (the split above drops the empty first part).
      if (!current[part]) {
        current[part] = isLast
          ? {
              id: filePath,
              name: part,
              type: "file",
              path: filePath,
              isOpen: false,
              isTarget: filePath === targetPath,
              isLibrary: isLibrary(filePath),
            }
          : {
              id: idPrefix + currentPath,
              name: part,
              type: "folder",
              path: currentPath,
              isOpen: false,
              children: {},
            };
      }

      if (isLast) {
        current[part].content = fileData.content;
      } else {
        current = current[part].children as Record<string, FileNode>;
      }
    });
  });

  // Convert the maps to arrays, and count the files and library files of each folder
  const convert = (nodes: Record<string, FileNode>): FileNode[] =>
    Object.values(nodes).map((node) => {
      if (node.type === "file") return node;
      const children = convert(node.children as Record<string, FileNode>);
      const files = children.reduce((total, child) => total + (child.type === "file" ? 1 : (child.fileCount ?? 0)), 0);
      return {
        ...node,
        children,
        fileCount: files,
        isLibrary: children.length > 0 && children.every((child) => child.isLibrary),
      };
    });

  return convert(root);
}

/**
 * Converts flat file paths into a folder tree for react-arborist. Files that
 * the compiled contract does not use go into one "Other files" group at the end.
 */
export function buildFileTreeWithIds(
  sources: Record<string, SourceData>,
  fullyQualifiedName: string,
  { compiledPaths, isLibrary = () => false }: BuildFileTreeOptions = {}
): FileNode[] {
  const targetPath = fullyQualifiedName.substring(0, fullyQualifiedName.lastIndexOf(":"));
  const entries = Object.entries(sources);

  const hasCompiledList = !!compiledPaths && compiledPaths.size > 0;
  const compiled = hasCompiledList ? entries.filter(([path]) => compiledPaths.has(path)) : entries;
  const other = hasCompiledList ? entries.filter(([path]) => !compiledPaths.has(path)) : [];

  const tree = buildTree(compiled, targetPath, isLibrary, "");
  if (other.length === 0) return tree;

  return [
    ...tree,
    {
      id: OTHER_FILES_GROUP_ID,
      name: "Other files",
      type: "folder",
      path: "",
      isOpen: false,
      isOtherGroup: true,
      fileCount: other.length,
      children: buildTree(other, targetPath, isLibrary, `${OTHER_FILES_GROUP_ID}/`),
    },
  ];
}
