/**
 * Sizes for the contract details: bytecode sizes against Ethereum's limits,
 * and lines of source code.
 */

/** EIP-170: the largest deployed (runtime) code on Ethereum, in bytes. */
export const RUNTIME_SIZE_LIMIT = 24_576;
/** EIP-3860: the largest creation code (initcode) on Ethereum, in bytes. */
export const INITCODE_SIZE_LIMIT = 49_152;

/** The number of bytes in a hex string (with or without 0x). Library placeholders count as their 20 bytes. */
export function hexByteLength(hex: string | undefined | null): number {
  if (!hex) return 0;
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Math.floor(body.length / 2);
}

/** The number of lines in a text. A final line break does not start a new line. */
export function countLines(text: string): number {
  if (!text) return 0;
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  return text.endsWith("\n") ? lines - 1 : lines;
}

export interface LineStats {
  // All lines of the files that count (the compiled files, if known)
  total: number;
  // Lines in library files (see libraryFiles.ts); the main file is never library code
  library: number;
  own: number;
  // The same split for the number of files
  files: { total: number; library: number; own: number };
}

/**
 * Lines of source code. If `compiledPaths` is given, only those files count:
 * the other files in `sources` are not part of the compiled contract.
 */
export function lineStats(
  sources: Record<string, { content: string }>,
  isLibraryPath: (path: string) => boolean,
  mainFile: string,
  compiledPaths?: Set<string>
): LineStats {
  let total = 0;
  let library = 0;
  let fileCount = 0;
  let libraryFiles = 0;
  for (const [path, { content }] of Object.entries(sources)) {
    if (compiledPaths && !compiledPaths.has(path)) continue;
    const lines = countLines(content);
    total += lines;
    fileCount++;
    if (path !== mainFile && isLibraryPath(path)) {
      library += lines;
      libraryFiles++;
    }
  }
  return {
    total,
    library,
    own: total - library,
    files: { total: fileCount, library: libraryFiles, own: fileCount - libraryFiles },
  };
}
