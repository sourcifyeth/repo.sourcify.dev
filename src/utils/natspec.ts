/**
 * NatSpec: the documentation comments of Solidity (`///` and `/** … *\/`) and
 * the Vyper docstring tags. For the main contract, the compiler's userdoc and
 * devdoc are the most exact source; for other code, the comment above the
 * declaration is parsed here.
 */

import { escapeMarkdown, inlineCode } from "./markdown";

export interface NatSpec {
  title?: string;
  author?: string;
  notice?: string;
  dev?: string;
  params: Array<{ name: string; description: string }>;
  returns: string[];
  custom: Array<{ tag: string; description: string }>;
  inheritdoc?: string;
  // Where the documentation was found (set by the source view)
  source?: "compiler" | "comment" | "docstring";
}

const emptySpec = (): NatSpec => ({ params: [], returns: [], custom: [] });

const isEmpty = (spec: NatSpec) =>
  !spec.title && !spec.author && !spec.notice && !spec.dev && !spec.params.length && !spec.returns.length && !spec.custom.length && !spec.inheritdoc;

/**
 * The text of the documentation comment that ends on the line before
 * `declarationLine` (1-based): a run of `///` lines, or a `/** … *\/` block.
 * Returns undefined if there is none.
 */
export function docCommentAbove(content: string, declarationLine: number): string | undefined {
  const lines = content.split("\n").map((line) => line.replace(/\r$/, ""));
  let index = declarationLine - 2;
  if (index < 0) return undefined;

  if (/^\s*\/\/\//.test(lines[index])) {
    const collected: string[] = [];
    while (index >= 0 && /^\s*\/\/\//.test(lines[index])) {
      collected.unshift(lines[index].replace(/^\s*\/\/\/ ?/, ""));
      index--;
    }
    return collected.join("\n");
  }

  if (/\*\/\s*$/.test(lines[index])) {
    const end = index;
    while (index >= 0 && !/\/\*\*/.test(lines[index])) index--;
    if (index < 0) return undefined;
    return lines
      .slice(index, end + 1)
      .join("\n")
      .replace(/^\s*\/\*\*/, "")
      .replace(/\*\/\s*$/, "")
      .split("\n")
      .map((line) => line.replace(/^\s*\* ?/, ""))
      .join("\n")
      .trim();
  }
  return undefined;
}

/** Parses the text of a doc comment into its tags. Text before the first tag is the notice. */
export function parseNatSpec(text: string): NatSpec | undefined {
  const spec = emptySpec();
  let current: { tag: string; text: string } | null = { tag: "notice", text: "" };
  const flush = () => {
    if (!current) return;
    const value = current.text.replace(/\s+/g, " ").trim();
    const { tag } = current;
    current = null;
    if (!value && tag !== "inheritdoc") return;
    if (tag === "notice") spec.notice = spec.notice ? `${spec.notice} ${value}` : value;
    else if (tag === "dev") spec.dev = spec.dev ? `${spec.dev} ${value}` : value;
    else if (tag === "title") spec.title = value;
    else if (tag === "author") spec.author = value;
    else if (tag === "return") spec.returns.push(value);
    else if (tag === "inheritdoc") spec.inheritdoc = value;
    else if (tag === "param") {
      const [name, ...description] = value.split(" ");
      spec.params.push({ name, description: description.join(" ") });
    } else if (tag.startsWith("custom:")) spec.custom.push({ tag: tag.slice(7), description: value });
  };
  for (const line of text.split("\n")) {
    const tagged = /^\s*@([\w:-]+)\s?(.*)$/.exec(line);
    if (tagged) {
      flush();
      current = { tag: tagged[1], text: tagged[2] };
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  flush();
  return isEmpty(spec) ? undefined : spec;
}

type Docs = Record<string, unknown> | null | undefined;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * NatSpec from the compiler's userdoc and devdoc, for one member of the main
 * contract. `key` is the canonical signature (functions, events, errors), or
 * the variable name (state variables), or "constructor".
 */
export function natSpecFromCompiler(
  userdoc: Docs,
  devdoc: Docs,
  section: "methods" | "events" | "errors" | "stateVariables",
  key: string
): NatSpec | undefined {
  const pick = (docs: Docs) => {
    const entry = record(docs)[section];
    const value = record(entry)[key];
    // Errors are lists, because several errors can share a signature
    return record(Array.isArray(value) ? value[0] : value);
  };
  const user = pick(userdoc);
  const dev = pick(devdoc);
  const spec = emptySpec();
  spec.notice = text(user.notice);
  spec.dev = text(dev.details);
  for (const [name, description] of Object.entries(record(dev.params))) {
    if (typeof description === "string") spec.params.push({ name, description });
  }
  const returns = record(dev.returns);
  for (const [name, description] of Object.entries(returns)) {
    if (typeof description === "string") spec.returns.push(/^_\d+$/.test(name) ? description : `${name}: ${description}`);
  }
  if (typeof dev.return === "string") spec.returns.push(dev.return);
  for (const [tag, value] of Object.entries(dev)) {
    if (tag.startsWith("custom:") && typeof value === "string") spec.custom.push({ tag: tag.slice(7), description: value });
  }
  return isEmpty(spec) ? undefined : spec;
}

/**
 * Markdown for a hover. All NatSpec text comes from the contract, so it is
 * escaped (or put in inline code): it shows as plain text, never as links or images.
 */
export function natSpecToMarkdown(spec: NatSpec): string {
  const text = escapeMarkdown;
  const parts: string[] = [];
  if (spec.title) parts.push(`**${text(spec.title)}**`);
  if (spec.notice) parts.push(text(spec.notice));
  if (spec.dev) parts.push(`*Dev:* ${text(spec.dev)}`);
  if (spec.params.length) parts.push(spec.params.map((p) => `- ${inlineCode(p.name)} ${text(p.description)}`).join("\n"));
  if (spec.returns.length) parts.push(spec.returns.map((r) => `- *Returns:* ${text(r)}`).join("\n"));
  for (const custom of spec.custom) parts.push(`*${text(custom.tag)}:* ${text(custom.description)}`);
  if (spec.author) parts.push(`*Author:* ${text(spec.author)}`);
  if (spec.inheritdoc && parts.length === 0) parts.push(`*Documented in* ${inlineCode(spec.inheritdoc)}`);
  return parts.join("\n\n");
}
