/**
 * Text search across all source files of a contract. It runs on the raw
 * source strings, not on Monaco, so it works before the editor loads and for
 * files that no tab shows.
 *
 * Positions are Monaco-style: lines and columns start at 1, and columns count
 * UTF-16 code units (the same units as JavaScript string indexes).
 */

export interface SearchOptions {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchMatch {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  // The text of the start line, without the line break
  lineText: string;
}

export interface FileSearchResult {
  path: string;
  matches: SearchMatch[];
}

export interface SearchResult {
  files: FileSearchResult[];
  total: number;
  // True if the search stopped at the result limit
  truncated: boolean;
}

export const DEFAULT_MAX_RESULTS = 2000;

// Characters that can be part of a Solidity or Vyper identifier
const WORD_CHAR = "[A-Za-z0-9_$]";

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the regular expression for the options. Returns null for an empty
 * query, and an error message for an invalid regular expression.
 */
export function buildSearchRegExp(options: SearchOptions): RegExp | { error: string } | null {
  if (!options.query) return null;
  let source = options.regex ? options.query : escapeRegExp(options.query);
  if (options.wholeWord) source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`;
  // "m" makes ^ and $ match at line breaks, as in VS Code
  const flags = "gm" + (options.matchCase ? "" : "i");
  try {
    return new RegExp(source, flags);
  } catch (error) {
    // Browsers put the whole pattern in the message ("Invalid regular expression: /a(/gim: Unterminated
    // group"). Keep only the reason, because the user sees the pattern in the search box.
    const reason = error instanceof Error ? error.message.replace(/^Invalid regular expression: \/[\s\S]*\/[a-z]*: /, "") : "";
    return { error: reason ? `Invalid regular expression: ${reason}` : "Invalid regular expression" };
  }
}

/** Offsets where each line starts. Line N (1-based) starts at index N-1. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}

// The 0-based index of the line that holds the offset
function lineIndexAt(starts: number[], offset: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

function lineText(text: string, starts: number[], index: number): string {
  const end = index + 1 < starts.length ? starts[index + 1] - 1 : text.length;
  return text.slice(starts[index], end).replace(/\r$/, "");
}

/**
 * Finds the matches of a global regular expression in one text. Empty
 * matches (for example from `a*`) are skipped.
 */
export function findMatchesInText(text: string, regExp: RegExp, limit = Infinity): SearchMatch[] {
  const matches: SearchMatch[] = [];
  if (limit <= 0) return matches;
  let starts: number[] | null = null;
  const pattern = new RegExp(regExp.source, regExp.flags.includes("g") ? regExp.flags : regExp.flags + "g");
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(text)) !== null) {
    if (found[0].length === 0) {
      pattern.lastIndex++;
      continue;
    }
    if (!starts) starts = lineStarts(text);
    const start = found.index;
    const end = start + found[0].length;
    const startIndex = lineIndexAt(starts, start);
    const endIndex = lineIndexAt(starts, end);
    matches.push({
      startLine: startIndex + 1,
      startColumn: start - starts[startIndex] + 1,
      endLine: endIndex + 1,
      endColumn: end - starts[endIndex] + 1,
      lineText: lineText(text, starts, startIndex),
    });
    if (matches.length >= limit) break;
  }
  return matches;
}

/**
 * Searches all files. The `firstPath` file (the compilation target) comes
 * first; the other files follow in path order.
 */
export function searchSources(
  sources: Record<string, { content: string }>,
  regExp: RegExp,
  { maxResults = DEFAULT_MAX_RESULTS, firstPath }: { maxResults?: number; firstPath?: string } = {}
): SearchResult {
  const paths = Object.keys(sources).sort((a, b) => {
    if (a === firstPath) return -1;
    if (b === firstPath) return 1;
    return a.localeCompare(b);
  });
  const files: FileSearchResult[] = [];
  let total = 0;
  let truncated = false;
  for (const path of paths) {
    const remaining = maxResults - total;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    // Ask for one more than fits, to know if the limit cut the results
    const matches = findMatchesInText(sources[path].content, regExp, remaining + 1);
    if (matches.length > remaining) {
      matches.length = remaining;
      truncated = true;
    }
    if (matches.length > 0) {
      files.push({ path, matches });
      total += matches.length;
    }
    if (truncated) break;
  }
  return { files, total, truncated };
}
