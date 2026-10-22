/**
 * Finds the source file that a Solidity `import` path points to, among the
 * paths of a verified contract. The rules follow the compiler:
 *
 * 1. A path that starts with "./" or "../" is relative to the importing file.
 * 2. Otherwise, the remappings apply: the longest matching prefix wins, and a
 *    remapping with a context applies only to files under that context.
 * 3. Otherwise, the import path is itself a source path.
 *
 * If none of these give a known file, the last try is a file whose path ends
 * with the import path (sources from some explorers have an extra folder in
 * front). It is used only when exactly one file matches.
 */

export interface Remapping {
  context: string;
  prefix: string;
  target: string;
}

/** Reads remappings of the form `context:prefix=target` (the context is optional). */
export function parseRemappings(remappings: string[] = []): Remapping[] {
  const parsed: Remapping[] = [];
  for (const remapping of remappings) {
    const equals = remapping.indexOf("=");
    if (equals <= 0) continue;
    const left = remapping.slice(0, equals);
    const target = remapping.slice(equals + 1);
    const colon = left.indexOf(":");
    const context = colon === -1 ? "" : left.slice(0, colon);
    const prefix = colon === -1 ? left : left.slice(colon + 1);
    if (prefix) parsed.push({ context, prefix, target });
  }
  return parsed;
}

// Joins and normalizes "a/b" + "../c" -> "a/c". A leading "/" is kept.
function joinPath(base: string, relative: string): string {
  const absolute = base.startsWith("/");
  const parts = [...base.split("/"), ...relative.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return (absolute ? "/" : "") + out.join("/");
}

const dirname = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

export function resolveImportPath(
  importPath: string,
  fromPath: string,
  paths: Set<string>,
  remappings: Remapping[] = []
): string | undefined {
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    const joined = joinPath(dirname(fromPath), importPath);
    if (paths.has(joined)) return joined;
  } else {
    const remapping = remappings
      .filter((r) => (r.context === "" || fromPath.startsWith(r.context)) && importPath.startsWith(r.prefix))
      .sort((a, b) => b.prefix.length - a.prefix.length || b.context.length - a.context.length)[0];
    if (remapping) {
      const remapped = remapping.target + importPath.slice(remapping.prefix.length);
      if (paths.has(remapped)) return remapped;
    }
    if (paths.has(importPath)) return importPath;
  }

  const tail = "/" + importPath.replace(/^(\.\.?\/)+/, "");
  const matches = [...paths].filter((path) => path.endsWith(tail));
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * The import paths in a Solidity file, with the offsets of the path text
 * (inside the quotes). `masked` is the same text with comments blanked out,
 * so that imports in comments are skipped.
 */
export function findImportPaths(text: string, masked: string): Array<{ path: string; start: number; end: number }> {
  const found: Array<{ path: string; start: number; end: number }> = [];
  const pattern = /\bimport\s+(?:[^;"']*?\s+from\s+)?(["'])([^"'\n]+)\1/g;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (masked.slice(index, index + 6) !== "import") continue;
    const start = index + match[0].lastIndexOf(match[2]);
    found.push({ path: match[2], start, end: start + match[2].length });
  }
  return found;
}
