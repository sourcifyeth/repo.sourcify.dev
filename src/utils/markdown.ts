/**
 * Safe Markdown for text that comes from a verified contract (NatSpec, file
 * paths, names). The uploader controls that text. Monaco's hover runs no
 * scripts, but it does render links and images, so contract text must never
 * become Markdown syntax: an image would load from any server when someone
 * hovers a name, and a link could look like part of the page.
 */

/** Puts a backslash before every ASCII punctuation sign, so the text shows as plain text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

// The longest run of backticks in a text
const longestBacktickRun = (text: string) => Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));

/** Inline code that the text cannot close: the fence is longer than any backtick run in it. */
export function inlineCode(text: string): string {
  const fence = "`".repeat(longestBacktickRun(text) + 1);
  // A space keeps a backtick at the start or end from joining the fence
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** A fenced code block that the text cannot close. */
export function codeBlock(language: string, text: string): string {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(text) + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}
