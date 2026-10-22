/**
 * Tells library files (code from dependencies such as OpenZeppelin or
 * solmate) apart from the project's own code, from the source path only.
 *
 * A path counts as a library path if:
 * - it is inside `node_modules/`, or
 * - a folder in it is an npm scope (`@openzeppelin/…`, `contracts/@uniswap/…`), or
 * - it starts with `lib/` (the Foundry folder for dependencies), or
 * - a folder in it has the name of a well-known library, or
 * - it starts with the prefix of a remapping whose target is a library path
 *   (for example `solmate/=lib/solmate/src/` makes `solmate/…` a library path).
 *
 * The rules are a best guess: a project that keeps its own code under `lib/`
 * gets that code marked as library code.
 */

const KNOWN_LIBRARY_FOLDERS = [
  "openzeppelin-contracts",
  "openzeppelin-contracts-upgradeable",
  "solmate",
  "solady",
  "forge-std",
  "ds-test",
];

const LIBRARY_PATH_PATTERNS: RegExp[] = [
  /(^|\/)node_modules\//,
  /(^|\/)@[^/]+\//,
  /^lib\//,
  new RegExp(`(^|/)(${KNOWN_LIBRARY_FOLDERS.join("|")})/`),
];

function matchesLibraryPattern(path: string): boolean {
  const normalized = path.replace(/^\.?\//, "");
  return LIBRARY_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Returns the import prefixes of remappings that point into library code.
 * A remapping has the form `context:prefix=target`; the context is optional.
 */
export function libraryRemappingPrefixes(remappings: string[] = []): string[] {
  const prefixes: string[] = [];
  for (const remapping of remappings) {
    const withoutContext = remapping.includes(":") ? remapping.slice(remapping.indexOf(":") + 1) : remapping;
    const separator = withoutContext.indexOf("=");
    if (separator <= 0) continue;
    const prefix = withoutContext.slice(0, separator);
    const target = withoutContext.slice(separator + 1);
    if (matchesLibraryPattern(target)) prefixes.push(prefix);
  }
  return prefixes;
}

/** Returns a function that tells whether a source path is library code. */
export function createLibraryPathCheck(remappings: string[] = []): (path: string) => boolean {
  const prefixes = libraryRemappingPrefixes(remappings);
  return (path: string) => matchesLibraryPattern(path) || prefixes.some((prefix) => path.startsWith(prefix));
}
