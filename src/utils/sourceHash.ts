/**
 * The reader position in the source view lives in the URL hash, for example
 * `#file=contracts/Token.sol&L=10-20`. The hash never reaches the server, so a
 * change costs no server render and no cache entry. Other sections of the page
 * can link into the source with a plain `<a href="#file=…">`.
 *
 * Keys:
 * - `file`: source path as it appears in the Sourcify `sources` map
 * - `L`: a line or line range, `L=10` or `L=10-20` (1-based, inclusive)
 * - `R`: a byte range `R=<start>-<end>` in the file (UTF-8 offsets from source maps)
 * - `sym`: a canonical signature such as `transfer(address,uint256)`; the source
 *   view resolves it to a declaration once the symbol index exists
 *
 * `R` and `sym` are parsed now so that links keep working when later features
 * start to write them.
 */

export interface LineRange {
  start: number;
  end: number;
}

export interface ByteRange {
  start: number;
  end: number;
}

export interface SourceLocation {
  file?: string;
  lines?: LineRange;
  range?: ByteRange;
  symbol?: string;
}

const RANGE_PATTERN = /^(\d+)(?:-(\d+))?$/;

function parseRange(value: string | null): { start: number; end: number } | undefined {
  if (!value) return undefined;
  const match = RANGE_PATTERN.exec(value.trim());
  if (!match) return undefined;
  const a = Number(match[1]);
  const b = match[2] === undefined ? a : Number(match[2]);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Returns null if the hash holds no source location (for example a plain `#abi` anchor). */
export function parseSourceHash(hash: string): SourceLocation | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const file = params.get("file") || undefined;
  const symbol = params.get("sym") || undefined;
  if (!file && !symbol) return null;

  const lines = parseRange(params.get("L"));
  const range = parseRange(params.get("R"));
  const location: SourceLocation = {};
  if (file) location.file = file;
  if (lines && lines.start >= 1) location.lines = lines;
  if (range) location.range = range;
  if (symbol) location.symbol = symbol;
  return location;
}

// Keep common path and signature characters readable in the URL. `&`, `#`,
// `=`, `%`, `+` and spaces stay encoded, so the hash still parses as
// key=value pairs.
function encodeForHash(value: string): string {
  return encodeURIComponent(value).replace(/%(2F|40|3A|2C|28|29)/gi, (escape) => decodeURIComponent(escape));
}

function formatRange(range: { start: number; end: number }): string {
  return range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`;
}

/** Returns the hash with the leading `#`, or an empty string for an empty location. */
export function formatSourceHash(location: SourceLocation): string {
  const parts: string[] = [];
  if (location.file) parts.push(`file=${encodeForHash(location.file)}`);
  if (location.lines) parts.push(`L=${formatRange(location.lines)}`);
  if (location.range) parts.push(`R=${formatRange(location.range)}`);
  if (location.symbol) parts.push(`sym=${encodeForHash(location.symbol)}`);
  return parts.length ? `#${parts.join("&")}` : "";
}
