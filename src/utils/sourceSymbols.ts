/**
 * Symbols (contracts, functions, events, …) of one source file, for the
 * outline, "Go to symbol" and the `@` / `#` prefixes in Go to file.
 *
 * Solidity files use the output of @solidity-parser/parser. If the parser
 * fails (very old or very new syntax), a regex scan is the fallback. Vyper
 * files always use a regex scan, because no Vyper parser runs in the browser.
 *
 * Positions are Monaco-style: lines and columns start at 1, and the end
 * column points after the last character.
 */

import { lineStarts } from "./sourceSearch";

export type SymbolKind =
  | "contract"
  | "abstractContract"
  | "interface"
  | "library"
  | "function"
  | "constructor"
  | "fallback"
  | "receive"
  | "modifier"
  | "event"
  | "error"
  | "struct"
  | "enum"
  | "stateVariable"
  | "constant"
  | "userType";

export interface SymbolRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface SourceSymbol {
  kind: SymbolKind;
  name: string;
  // Parameter types of functions, events and errors, or the type of a variable
  detail?: string;
  // The parameter types one by one, as written in the source (for selectors)
  parameters?: string[];
  // The parameter names, in the same order (empty for unnamed parameters)
  parameterNames?: string[];
  // Base contracts, as written after "is"
  bases?: string[];
  // An anonymous event has no topic
  anonymous?: boolean;
  visibility?: string;
  // payable, view, pure, constant, immutable, transient
  mutability?: string;
  // The whole declaration
  range: SymbolRange;
  // Only the name, for the selection when the user jumps to the symbol
  nameRange: SymbolRange;
  children?: SourceSymbol[];
}

export interface FileSymbols {
  symbols: SourceSymbol[];
  // How the symbols were found
  method: "parser" | "regex" | "none";
}

export type SourceLanguage = "solidity" | "vyper" | "other";

export function languageOfPath(path: string): SourceLanguage {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "sol") return "solidity";
  if (extension === "vy" || extension === "vyi") return "vyper";
  return "other";
}

// ---------------------------------------------------------------------------
// Offsets to positions

class Positions {
  private readonly starts: number[];
  constructor(private readonly text: string) {
    this.starts = lineStarts(text);
  }

  // A position before the character at `offset`
  at(offset: number): { line: number; column: number } {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (this.starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: offset - this.starts[low] + 1 };
  }

  // `end` is exclusive
  range(start: number, end: number): SymbolRange {
    const from = this.at(start);
    const to = this.at(Math.max(start, end));
    return { startLine: from.line, startColumn: from.column, endLine: to.line, endColumn: to.column };
  }
}

const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/;

// The offset of `word` as a whole word in text[from, to), or -1
function findWord(text: string, word: string, from: number, to: number): number {
  let index = text.indexOf(word, from);
  while (index !== -1 && index < to) {
    const before = index > 0 ? text[index - 1] : "";
    const after = text[index + word.length] ?? "";
    if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) return index;
    index = text.indexOf(word, index + 1);
  }
  return -1;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Solidity, from the parser output

/* eslint-disable @typescript-eslint/no-explicit-any -- the parser AST is loosely typed here on purpose */
type AstNode = any;

/**
 * Builds symbols from the output of `parse(content, { loc: true, range: true })`
 * of @solidity-parser/parser. Parser ranges are inclusive character offsets.
 */
export function symbolsFromSolidityAst(ast: AstNode, content: string): SourceSymbol[] {
  const positions = new Positions(content);

  const declarationRange = (node: AstNode) => positions.range(node.range[0], node.range[1] + 1);

  // The name is not a node of its own, so find it in the declaration text
  const nameRangeOf = (node: AstNode, word: string | null | undefined): SymbolRange => {
    if (word) {
      const index = findWord(content, word, node.range[0], node.range[1] + 1);
      if (index !== -1) return positions.range(index, index + word.length);
    }
    return positions.range(node.range[0], node.range[0]);
  };

  const typeText = (typeName: AstNode) =>
    typeName?.range ? collapse(content.slice(typeName.range[0], typeName.range[1] + 1)) : "";
  const typeList = (parameters: AstNode[] | null | undefined): string[] =>
    (parameters ?? []).map((parameter) => typeText(parameter.typeName));
  const parameterTypes = (parameters: AstNode[] | null | undefined) => `(${typeList(parameters).join(", ")})`;
  const nameList = (parameters: AstNode[] | null | undefined): string[] =>
    (parameters ?? []).map((parameter) => parameter.name ?? "");
  const visibilityOf = (value: string | undefined | null) => (value && value !== "default" ? value : undefined);

  const fromFunction = (node: AstNode): SourceSymbol => {
    const kind: SymbolKind = node.isConstructor
      ? "constructor"
      : node.isReceiveEther
        ? "receive"
        : node.isFallback
          ? "fallback"
          : "function";
    const name = kind === "function" ? node.name : kind;
    return {
      kind,
      name,
      detail: parameterTypes(node.parameters),
      parameters: typeList(node.parameters),
      parameterNames: nameList(node.parameters),
      visibility: visibilityOf(node.visibility),
      mutability: node.stateMutability ?? undefined,
      range: declarationRange(node),
      nameRange: nameRangeOf(node, name),
    };
  };

  const fromMember = (node: AstNode): SourceSymbol[] => {
    switch (node.type) {
      case "FunctionDefinition":
        return [fromFunction(node)];
      case "ModifierDefinition":
        return [
          {
            kind: "modifier",
            name: node.name,
            detail: node.parameters ? parameterTypes(node.parameters) : undefined,
            parameters: node.parameters ? typeList(node.parameters) : undefined,
            range: declarationRange(node),
            nameRange: nameRangeOf(node, node.name),
          },
        ];
      case "EventDefinition":
        return [
          {
            kind: "event",
            name: node.name,
            detail: parameterTypes(node.parameters),
            parameters: typeList(node.parameters),
            parameterNames: nameList(node.parameters),
            anonymous: !!node.isAnonymous,
            range: declarationRange(node),
            nameRange: nameRangeOf(node, node.name),
          },
        ];
      case "CustomErrorDefinition":
        return [
          {
            kind: "error",
            name: node.name,
            detail: parameterTypes(node.parameters),
            parameters: typeList(node.parameters),
            parameterNames: nameList(node.parameters),
            range: declarationRange(node),
            nameRange: nameRangeOf(node, node.name),
          },
        ];
      case "StructDefinition":
        return [
          { kind: "struct", name: node.name, range: declarationRange(node), nameRange: nameRangeOf(node, node.name) },
        ];
      case "EnumDefinition":
        return [
          { kind: "enum", name: node.name, range: declarationRange(node), nameRange: nameRangeOf(node, node.name) },
        ];
      case "TypeDefinition":
        return [
          {
            kind: "userType",
            name: node.name,
            detail: typeText(node.definition),
            range: declarationRange(node),
            nameRange: nameRangeOf(node, node.name),
          },
        ];
      case "StateVariableDeclaration":
        return (node.variables ?? []).map((variable: AstNode) => ({
          kind: variable.isDeclaredConst ? "constant" : "stateVariable",
          name: variable.name,
          detail: typeText(variable.typeName),
          visibility: visibilityOf(variable.visibility),
          mutability: variable.isDeclaredConst
            ? "constant"
            : variable.isImmutable
              ? "immutable"
              : variable.isTransient
                ? "transient"
                : undefined,
          range: declarationRange(node),
          nameRange: variable.identifier?.range
            ? positions.range(variable.identifier.range[0], variable.identifier.range[1] + 1)
            : nameRangeOf(node, variable.name),
        }));
      case "FileLevelConstant":
        return [
          {
            kind: "constant",
            name: node.name,
            detail: typeText(node.typeName),
            mutability: "constant",
            range: declarationRange(node),
            nameRange: nameRangeOf(node, node.name),
          },
        ];
      default:
        return [];
    }
  };

  const symbols: SourceSymbol[] = [];
  for (const node of ast.children ?? []) {
    if (node.type === "ContractDefinition") {
      const kind: SymbolKind =
        node.kind === "interface"
          ? "interface"
          : node.kind === "library"
            ? "library"
            : node.kind === "abstract"
              ? "abstractContract"
              : "contract";
      const bases = (node.baseContracts ?? []).map((base: AstNode) => base.baseName?.namePath).filter(Boolean);
      symbols.push({
        kind,
        name: node.name,
        detail: bases.length ? `is ${bases.join(", ")}` : undefined,
        bases,
        range: declarationRange(node),
        nameRange: nameRangeOf(node, node.name),
        children: (node.subNodes ?? []).flatMap(fromMember),
      });
    } else {
      symbols.push(...fromMember(node));
    }
  }
  return symbols;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Regex fallbacks

/**
 * Replaces comments and string contents with spaces, but keeps line breaks.
 * Offsets stay the same, so matches on the result map back to the source.
 */
export function maskCommentsAndStrings(text: string, language: "solidity" | "vyper"): string {
  const out = text.split("");
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (language === "solidity" && char === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (language === "solidity" && char === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (language === "vyper" && char === "#") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (language === "vyper" && (text.startsWith('"""', i) || text.startsWith("'''", i))) {
      const quote = text.slice(i, i + 3);
      const end = text.indexOf(quote, i + 3);
      const stop = end === -1 ? text.length : end + 3;
      blank(i, stop);
      i = stop;
    } else if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== char && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      blank(i + 1, Math.min(j, text.length));
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

// The offset after the brace that closes the one at `open`, or the text length
function matchBrace(masked: string, open: number): number {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}" && --depth === 0) return i + 1;
  }
  return masked.length;
}

// The end of a declaration that starts at `start`: its body in braces, or the next ";"
function declarationEnd(masked: string, start: number): number {
  const brace = masked.indexOf("{", start);
  const semicolon = masked.indexOf(";", start);
  if (brace !== -1 && (semicolon === -1 || brace < semicolon)) return matchBrace(masked, brace);
  return semicolon === -1 ? masked.length : semicolon + 1;
}

const SOLIDITY_CONTAINER = /\b(abstract\s+contract|contract|interface|library)\s+([A-Za-z_$][\w$]*)/g;
const SOLIDITY_MEMBER =
  /\b(function|modifier|event|error|struct|enum)\s+([A-Za-z_$][\w$]*)|\b(constructor|fallback|receive)\s*\(/g;

/** A best-effort scan for Solidity declarations, used when the parser fails. */
export function regexSoliditySymbols(content: string): SourceSymbol[] {
  const masked = maskCommentsAndStrings(content, "solidity");
  const positions = new Positions(content);
  // The containers, with their offsets for the "which container holds this member" check
  const containers: Array<{ symbol: SourceSymbol; start: number; end: number }> = [];

  for (const match of masked.matchAll(SOLIDITY_CONTAINER)) {
    const start = match.index ?? 0;
    const keyword = match[1].replace(/\s+/g, " ");
    const kind: SymbolKind =
      keyword === "interface"
        ? "interface"
        : keyword === "library"
          ? "library"
          : keyword === "contract"
            ? "contract"
            : "abstractContract";
    const end = declarationEnd(masked, start);
    const nameStart = start + match[0].length - match[2].length;
    containers.push({
      symbol: {
        kind,
        name: match[2],
        range: positions.range(start, end),
        nameRange: positions.range(nameStart, nameStart + match[2].length),
        children: [],
      },
      start,
      end,
    });
  }

  const topLevel: SourceSymbol[] = [];
  for (const match of masked.matchAll(SOLIDITY_MEMBER)) {
    const start = match.index ?? 0;
    const keyword = (match[1] ?? match[3]) as string;
    const name = match[2] ?? match[3];
    const nameStart = match[2] ? start + match[0].length - match[2].length : start;
    const kind: SymbolKind = keyword === "function" ? "function" : (keyword as SymbolKind);
    const symbol: SourceSymbol = {
      kind,
      name,
      range: positions.range(start, declarationEnd(masked, start)),
      nameRange: positions.range(nameStart, nameStart + name.length),
    };
    const container = containers.find((c) => start > c.start && start < c.end);
    if (container) container.symbol.children!.push(symbol);
    else topLevel.push(symbol);
  }

  const result: SourceSymbol[] = [...topLevel, ...containers.map((container) => container.symbol)];
  return result.sort((a, b) => a.range.startLine - b.range.startLine || a.range.startColumn - b.range.startColumn);
}

const VYPER_DECORATOR_VISIBILITY = new Set(["external", "internal", "deploy"]);
const VYPER_DECORATOR_MUTABILITY = new Set(["view", "pure", "payable", "nonpayable"]);
const VYPER_KEYWORDS = new Set([
  "def",
  "event",
  "struct",
  "interface",
  "enum",
  "flag",
  "from",
  "import",
  "implements",
  "uses",
  "initializes",
  "exports",
  "if",
  "for",
  "return",
  "pass",
  "log",
]);

/** Top-level Vyper declarations, found by their position at the start of a line. */
export function regexVyperSymbols(content: string): SourceSymbol[] {
  const masked = maskCommentsAndStrings(content, "vyper");
  const positions = new Positions(content);
  const lines = masked.split("\n");
  const starts = lineStarts(masked);
  const symbols: SourceSymbol[] = [];

  // A block ends before the next line that starts at column 0 and is not empty
  const blockEnd = (lineIndex: number) => {
    let last = lineIndex;
    for (let j = lineIndex + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      if (!/^\s/.test(line)) break;
      last = j;
    }
    return starts[last] + lines[last].replace(/\r$/, "").length;
  };

  let decorators: string[] = [];
  lines.forEach((line, index) => {
    const offset = starts[index];
    const decorator = /^@(\w+)/.exec(line);
    if (decorator) {
      decorators.push(decorator[1]);
      return;
    }

    const definition = /^def\s+([A-Za-z_]\w*)\s*\(/.exec(line);
    if (definition) {
      const name = definition[1];
      const nameStart = offset + line.indexOf(name, 3);
      const kind: SymbolKind = name === "__init__" ? "constructor" : name === "__default__" ? "fallback" : "function";
      const signature = /\(([^)]*)\)/.exec(masked.slice(offset, blockEnd(index)));
      const parameters = signature
        ? signature[1]
            .split(",")
            .map((parameter) => collapse(parameter.split(":")[1]?.split("=")[0] ?? ""))
            .filter(Boolean)
        : undefined;
      symbols.push({
        kind,
        name,
        detail: parameters ? `(${parameters.join(", ")})` : undefined,
        parameters,
        visibility: decorators.find((d) => VYPER_DECORATOR_VISIBILITY.has(d)),
        mutability: decorators.find((d) => VYPER_DECORATOR_MUTABILITY.has(d)),
        range: positions.range(offset, blockEnd(index)),
        nameRange: positions.range(nameStart, nameStart + name.length),
      });
      decorators = [];
      return;
    }
    if (line.trim() !== "") decorators = [];

    const block = /^(event|struct|interface|enum|flag)\s+([A-Za-z_]\w*)\s*:/.exec(line);
    if (block) {
      const kind: SymbolKind =
        block[1] === "event"
          ? "event"
          : block[1] === "struct"
            ? "struct"
            : block[1] === "interface"
              ? "interface"
              : "enum";
      const nameStart = offset + block[0].indexOf(block[2], block[1].length);
      symbols.push({
        kind,
        name: block[2],
        range: positions.range(offset, blockEnd(index)),
        nameRange: positions.range(nameStart, nameStart + block[2].length),
      });
      return;
    }

    const variable = /^([A-Za-z_]\w*)\s*:\s*(.+?)\s*$/.exec(line.replace(/\r$/, ""));
    if (variable && !VYPER_KEYWORDS.has(variable[1])) {
      const type = variable[2];
      const wrapper = /^(public|constant|immutable|transient)\((.*)\)\s*(=.*)?$/.exec(type);
      const isConstant = /^constant\(/.test(type) || /\bconstant\(/.test(type);
      symbols.push({
        kind: isConstant ? "constant" : "stateVariable",
        name: variable[1],
        detail: collapse((wrapper ? wrapper[2] : type).split("=")[0]),
        visibility: /\bpublic\(/.test(type) ? "public" : undefined,
        mutability: isConstant
          ? "constant"
          : /\bimmutable\(/.test(type)
            ? "immutable"
            : /\btransient\(/.test(type)
              ? "transient"
              : undefined,
        range: positions.range(offset, offset + line.replace(/\r$/, "").length),
        nameRange: positions.range(offset, offset + variable[1].length),
      });
    }
  });
  return symbols;
}

/**
 * Finds the symbols of one file. `parseSolidity` is the parser's `parse`
 * function; without it, Solidity files use the regex scan.
 */
export function extractSymbols(
  content: string,
  language: SourceLanguage,
  parseSolidity?: (content: string, options: { loc: boolean; range: boolean }) => unknown
): FileSymbols {
  if (language === "vyper") return { symbols: regexVyperSymbols(content), method: "regex" };
  if (language !== "solidity") return { symbols: [], method: "none" };
  if (parseSolidity) {
    try {
      return {
        symbols: symbolsFromSolidityAst(parseSolidity(content, { loc: true, range: true }), content),
        method: "parser",
      };
    } catch {
      // Fall through to the regex scan
    }
  }
  return { symbols: regexSoliditySymbols(content), method: "regex" };
}

/** All symbols, depth first, each with its container (if any). */
export function flattenSymbols(
  symbols: SourceSymbol[]
): Array<{ symbol: SourceSymbol; container?: string; containerSymbol?: SourceSymbol }> {
  const out: Array<{ symbol: SourceSymbol; container?: string; containerSymbol?: SourceSymbol }> = [];
  for (const symbol of symbols) {
    out.push({ symbol });
    for (const child of symbol.children ?? [])
      out.push({ symbol: child, container: symbol.name, containerSymbol: symbol });
  }
  return out;
}

/** The innermost symbol whose declaration holds the line, as [container, member]. */
export function symbolsAtLine(symbols: SourceSymbol[], line: number): SourceSymbol[] {
  const holds = (symbol: SourceSymbol) => symbol.range.startLine <= line && line <= symbol.range.endLine;
  const outer = symbols.find(holds);
  if (!outer) return [];
  const inner = outer.children?.find(holds);
  return inner ? [outer, inner] : [outer];
}
