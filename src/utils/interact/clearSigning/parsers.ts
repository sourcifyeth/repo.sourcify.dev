/**
 * The inverse of the ERC-7730 display formats: from the text that a person types ("1.5", a date, a duration)
 * to the raw value of the argument, and back. All amounts use exact decimal math on text and bigint.
 * The SDK takes raw values only; these functions are the page's part of "reverse clear signing".
 */
import { scaleDecimal } from "../abi";

/* ----------------------------------------------------------- invalid text */

const INVALID_MARK = " (not valid)";

/**
 * What a field stores when its text cannot become a raw value: the text with a mark. The form then counts
 * the input as wrong (it is not a number), so an unparsed value is never encoded or sent.
 */
export const invalidRaw = (text: string) => `${text}${INVALID_MARK}`;

/** The text inside a value that `invalidRaw` made, or null for any other value. */
export const invalidText = (raw: string) => (raw.endsWith(INVALID_MARK) ? raw.slice(0, -INVALID_MARK.length) : null);

/** True for a whole number in decimal text, as the form stores it. */
export const isWholeNumber = (raw: string) => /^-?\d+$/.test(raw.trim());

/* ---------------------------------------------------------------- amounts */

/** Decimal text → the integer with `decimals` places: ("1.5", 6) → "1500000". Null if it does not fit. */
export function amountToRaw(text: string, decimals: number): string | null {
  return scaleDecimal(text, decimals);
}

/** The integer as decimal text, exact and without digit grouping: ("1500000", 6) → "1.5". */
export function rawToAmount(raw: string, decimals: number): string {
  const text = raw.trim();
  const negative = text.startsWith("-");
  const digits = (negative ? text.slice(1) : text).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals > 0 ? digits.slice(digits.length - decimals).replace(/0+$/, "") : "";
  return (negative ? "-" : "") + whole + (fraction ? `.${fraction}` : "");
}

/** The largest value of an integer type: 2^256 − 1 for uint256, 2^127 − 1 for int128. Null for other types. */
export function maxOfType(type: string): string | null {
  const match = /^(u?)int(\d*)$/.exec(type);
  if (!match) return null;
  const bits = Number(match[2] || 256);
  return (BigInt(2) ** BigInt(match[1] === "u" ? bits : bits - 1) - BigInt(1)).toString();
}

/**
 * True if the raw value is at or above the descriptor's threshold. Wallets then show the descriptor's message
 * ("Unlimited", "All") and not the number.
 */
export function reachesThreshold(raw: string, threshold: string | number | undefined): boolean {
  if (threshold === undefined || !isWholeNumber(raw)) return false;
  try {
    return BigInt(raw.trim()) >= BigInt(threshold);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- durations */

export const DURATION_UNITS = [
  { label: "seconds", seconds: 1 },
  { label: "minutes", seconds: 60 },
  { label: "hours", seconds: 3600 },
  { label: "days", seconds: 86400 },
] as const;

/** A number of units as seconds: ("1.5", 3600) → "5400". Null if the result is not a whole number of seconds. */
export function durationToRaw(text: string, unitSeconds: number): string | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match || (match[1] === "" && !match[2])) return null;
  const fraction = match[2] ?? "";
  const scaled = BigInt(match[1] + fraction || "0") * BigInt(unitSeconds);
  const divisor = BigInt(10) ** BigInt(fraction.length);
  if (scaled % divisor !== BigInt(0)) return null;
  return (scaled / divisor).toString();
}

/** Seconds as a number of the largest unit that divides them: "5400" → 90 minutes. */
export function rawToDuration(raw: string): { text: string; unitSeconds: number } {
  if (!isWholeNumber(raw) || raw.trim().startsWith("-")) return { text: raw, unitSeconds: 1 };
  const seconds = BigInt(raw.trim());
  if (seconds === BigInt(0)) return { text: "0", unitSeconds: 1 };
  for (const unit of [...DURATION_UNITS].reverse()) {
    if (seconds % BigInt(unit.seconds) === BigInt(0))
      return { text: (seconds / BigInt(unit.seconds)).toString(), unitSeconds: unit.seconds };
  }
  return { text: seconds.toString(), unitSeconds: 1 };
}

/* ------------------------------------------------------------------ dates */

/** The last second of the year 9999: larger timestamps are not dates that a date field can show. */
const MAX_DATE_SECONDS = 253402300799;

/**
 * A date and time in UTC, as a `datetime-local` field gives it ("2026-11-26T10:00" or with seconds),
 * as a Unix timestamp in seconds. Null if the text is not a real date.
 */
export function dateToRaw(text: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(ms) || ms < 0) return null;
  const date = new Date(ms);
  // Date.UTC accepts 31 February and moves it to March: such text is not a date
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return String(ms / 1000);
}

/** A Unix timestamp in seconds as "2026-11-26T10:00:00" (UTC), or null if it is not in the range of dates. */
export function rawToDate(raw: string): string | null {
  if (!isWholeNumber(raw) || raw.trim().startsWith("-")) return null;
  const seconds = BigInt(raw.trim());
  if (seconds > BigInt(MAX_DATE_SECONDS)) return null;
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 19);
}

/* ------------------------------------------------------------------ enums */

export interface EnumOption {
  /** The value that the form stores: text for a number, a boolean for a bool */
  value: string | boolean;
  label: string;
}

/**
 * The options of an `enum` format for a select. The descriptor maps raw values to labels; for a bool the keys
 * are "True" and "False" (in any case), for an integer the numbers.
 */
export function enumOptions(options: Record<string, string>, type: string): EnumOption[] {
  return Object.entries(options).flatMap(([key, label]): EnumOption[] => {
    if (type === "bool") {
      if (/^(true|1)$/i.test(key)) return [{ value: true, label }];
      if (/^(false|0)$/i.test(key)) return [{ value: false, label }];
      return [];
    }
    if (/^u?int\d*$/.test(type)) {
      try {
        return [{ value: BigInt(key).toString(), label }];
      } catch {
        return [];
      }
    }
    return [{ value: key, label }];
  });
}

/** The position of the stored value in the options, or -1 (also for an empty value). */
export function enumIndex(options: EnumOption[], stored: string | boolean): number {
  if (typeof stored === "boolean") return options.findIndex((option) => option.value === stored);
  const text = stored.trim();
  if (text === "") return -1;
  return options.findIndex((option) => {
    if (typeof option.value !== "string") return false;
    if (option.value === text) return true;
    try {
      return BigInt(option.value) === BigInt(text);
    } catch {
      return option.value.toLowerCase() === text.toLowerCase();
    }
  });
}
