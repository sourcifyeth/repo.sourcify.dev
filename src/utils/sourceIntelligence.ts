/**
 * Facts about declarations that combine the symbols of all compiled files,
 * the compiler's signatures and NatSpec, and the source text: which
 * declaration a name most likely means ("best guess", by name only), the
 * selector or topic of a declaration, and its documentation.
 */

import { docCommentAbove, NatSpec, natSpecFromCompiler, parseNatSpec } from "./natspec";
import {
  canonicalSignature,
  CompilerSignature,
  findCompilerSignature,
  getterParameters,
  hashSignature,
  UserTypeResolver,
} from "./selectors";
import { FileSymbols, flattenSymbols, SourceSymbol } from "./sourceSymbols";

export interface SymbolEntry {
  path: string;
  symbol: SourceSymbol;
  container?: SourceSymbol;
}

export interface CompilerData {
  // The name of the compiled contract (after ":" in the fully qualified name)
  targetContract: string;
  signatures?: { function: CompilerSignature[]; event: CompilerSignature[]; error: CompilerSignature[] };
  userdoc?: Record<string, unknown> | null;
  devdoc?: Record<string, unknown> | null;
}

export function symbolEntries(files: Map<string, FileSymbols>): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  for (const [path, fileSymbols] of files) {
    for (const { symbol, containerSymbol } of flattenSymbols(fileSymbols.symbols)) {
      entries.push({ path, symbol, container: containerSymbol });
    }
  }
  return entries;
}

const CONTRACT_KINDS = new Set(["contract", "abstractContract", "interface", "library"]);

/** Contract and interface names stand for `address` in an ABI signature, enum names for `uint8`. */
export function userTypeResolver(entries: SymbolEntry[]): UserTypeResolver {
  const kinds = new Map<string, Set<string>>();
  for (const { symbol } of entries) {
    if (!kinds.has(symbol.name)) kinds.set(symbol.name, new Set());
    kinds.get(symbol.name)!.add(symbol.kind);
  }
  return (name) => {
    const found = kinds.get(name);
    if (!found || found.size !== 1) return undefined;
    const [kind] = [...found];
    if (kind === "enum") return "uint8";
    if (kind === "contract" || kind === "abstractContract" || kind === "interface") return "address";
    return undefined;
  };
}

/** The main contract and its bases, nearest first (breadth first over `is` lists, by name). */
export function inheritanceChain(entries: SymbolEntry[], targetContract: string): string[] {
  const byName = new Map<string, SourceSymbol>();
  for (const { symbol } of entries) if (CONTRACT_KINDS.has(symbol.kind) && !byName.has(symbol.name)) byName.set(symbol.name, symbol);
  const chain: string[] = [];
  const queue = [targetContract];
  while (queue.length) {
    const name = queue.shift()!;
    if (chain.includes(name)) continue;
    chain.push(name);
    for (const base of byName.get(name)?.bases ?? []) queue.push(base.split(".").pop()!);
  }
  return chain;
}

/**
 * The declarations that a name can mean, most likely first: implementations
 * before interface declarations, then the main contract and its bases, then
 * the same file, then the path order.
 */
export function rankCandidates(entries: SymbolEntry[], name: string, fromPath: string, chain: string[]): SymbolEntry[] {
  const chainIndex = (entry: SymbolEntry) => {
    const container = entry.container?.name ?? entry.symbol.name;
    const index = chain.indexOf(container);
    return index === -1 ? chain.length : index;
  };
  const isInterface = (entry: SymbolEntry) => (entry.container?.kind ?? entry.symbol.kind) === "interface";
  return entries
    .filter((entry) => entry.symbol.name === name)
    .sort(
      (a, b) =>
        Number(isInterface(a)) - Number(isInterface(b)) ||
        chainIndex(a) - chainIndex(b) ||
        Number(a.path !== fromPath) - Number(b.path !== fromPath) ||
        a.path.localeCompare(b.path) ||
        a.symbol.range.startLine - b.symbol.range.startLine
    );
}

export interface SelectorInfo {
  kind: "selector" | "topic";
  value: string;
  signature: string;
  // True if it comes from the compiler's signatures; false if computed here
  fromCompiler: boolean;
}

/**
 * The 4-byte selector (functions, errors, getters of public state variables)
 * or the 32-byte topic (events) of a declaration, if it has one and it can
 * be known here.
 */
export function selectorInfo(
  entry: SymbolEntry,
  compiler: CompilerData,
  resolve: UserTypeResolver,
  chain: string[]
): SelectorInfo | undefined {
  const { symbol, container } = entry;
  const containerKind = container?.kind;
  if (containerKind === "library") return undefined;

  let types: string[] | undefined;
  let list: CompilerSignature[] = [];
  let kind: SelectorInfo["kind"] = "selector";
  if (symbol.kind === "function") {
    const callable = symbol.visibility === "external" || symbol.visibility === "public" || containerKind === "interface";
    if (!callable) return undefined;
    types = symbol.parameters;
    list = compiler.signatures?.function ?? [];
  } else if (symbol.kind === "error") {
    types = symbol.parameters;
    list = compiler.signatures?.error ?? [];
  } else if (symbol.kind === "event") {
    if (symbol.anonymous) return undefined;
    types = symbol.parameters;
    list = compiler.signatures?.event ?? [];
    kind = "topic";
  } else if ((symbol.kind === "stateVariable" || symbol.kind === "constant") && symbol.visibility === "public") {
    types = getterParameters(symbol.detail ?? "");
    list = compiler.signatures?.function ?? [];
  } else {
    return undefined;
  }
  if (!types) return undefined;

  // The compiler's signatures cover the main contract and what it inherits
  const inChain = !container || chain.includes(container.name);
  const fromCompiler = inChain ? findCompilerSignature(symbol.name, types, list, resolve) : undefined;
  if (fromCompiler) {
    return {
      kind,
      value: kind === "topic" ? fromCompiler.signatureHash32 : fromCompiler.signatureHash4,
      signature: fromCompiler.signature,
      fromCompiler: true,
    };
  }
  const signature = canonicalSignature(symbol.name, types, resolve);
  if (!signature) return undefined;
  const hash = hashSignature(signature);
  return { kind, value: kind === "topic" ? hash : hash.slice(0, 10), signature, fromCompiler: false };
}

// The docstring of a Vyper function: the first string in its body
function vyperDocstring(content: string, symbol: SourceSymbol): string | undefined {
  const lines = content.split("\n").slice(symbol.range.startLine - 1, symbol.range.endLine);
  const body = lines.join("\n");
  const start = body.search(/"""|'''/);
  if (start === -1) return undefined;
  const quote = body.slice(start, start + 3);
  const end = body.indexOf(quote, start + 3);
  if (end === -1) return undefined;
  // Only a docstring that comes before any other statement of the body
  const before = body.slice(0, start).split("\n").slice(1).join("\n");
  if (before.replace(/^\s*(def .*|.*\):|.*->.*:)\s*$/gm, "").trim()) return undefined;
  return body
    .slice(start + 3, end)
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

/**
 * The NatSpec of a declaration. Members of the main contract use the
 * compiler's userdoc/devdoc (which also resolve @inheritdoc); other code uses
 * the doc comment above the declaration, and follows one @inheritdoc.
 */
export function natSpecInfo(
  entry: SymbolEntry,
  content: string,
  compiler: CompilerData,
  selector: SelectorInfo | undefined,
  entries: SymbolEntry[],
  readContent: (path: string) => string,
  followInheritdoc = true
): NatSpec | undefined {
  const { symbol, container } = entry;
  if (container?.name === compiler.targetContract) {
    const key =
      symbol.kind === "constructor"
        ? "constructor"
        : symbol.kind === "stateVariable" || symbol.kind === "constant"
          ? symbol.name
          : selector?.signature;
    const section =
      symbol.kind === "event"
        ? "events"
        : symbol.kind === "error"
          ? "errors"
          : symbol.kind === "stateVariable" || symbol.kind === "constant"
            ? "stateVariables"
            : "methods";
    if (key) {
      const fromCompiler = natSpecFromCompiler(compiler.userdoc, compiler.devdoc, section, key);
      if (fromCompiler) {
        // The compiler's docs list parameters by name, not in declaration order
        const order = symbol.parameterNames ?? [];
        const position = (name: string) => (order.includes(name) ? order.indexOf(name) : order.length);
        fromCompiler.params.sort((a, b) => position(a.name) - position(b.name));
        return { ...fromCompiler, source: "compiler" };
      }
    }
  }

  const isVyper = entry.path.endsWith(".vy") || entry.path.endsWith(".vyi");
  const text = isVyper ? vyperDocstring(content, symbol) : docCommentAbove(content, symbol.range.startLine);
  const parsed = text ? parseNatSpec(text) : undefined;
  const spec = parsed ? { ...parsed, source: isVyper ? ("docstring" as const) : ("comment" as const) } : undefined;
  if (spec?.inheritdoc && followInheritdoc) {
    const parent = entries.find((e) => e.container?.name === spec.inheritdoc && e.symbol.name === symbol.name);
    if (parent) {
      const inherited = natSpecInfo(parent, readContent(parent.path), compiler, selector, entries, readContent, false);
      if (inherited) return inherited;
    }
  }
  return spec;
}

/** A one-line declaration for the hover, for example `function mint(address, uint256) external payable`. */
export function declarationLine(symbol: SourceSymbol): string {
  const words = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" ");
  switch (symbol.kind) {
    case "contract":
    case "abstractContract":
    case "interface":
    case "library": {
      const keyword = symbol.kind === "abstractContract" ? "abstract contract" : symbol.kind;
      return words(keyword, symbol.name, symbol.bases?.length ? `is ${symbol.bases.join(", ")}` : undefined);
    }
    case "stateVariable":
    case "constant":
      return words(symbol.detail, symbol.visibility, symbol.mutability, symbol.name);
    case "struct":
    case "enum":
      return words(symbol.kind, symbol.name);
    case "userType":
      return words("type", symbol.name, "is", symbol.detail);
    case "constructor":
    case "fallback":
    case "receive":
      return words(symbol.kind + (symbol.detail ?? "()"), symbol.visibility, symbol.mutability);
    default:
      return words(`${symbol.kind} ${symbol.name}${symbol.detail ?? ""}`, symbol.visibility, symbol.mutability);
  }
}

/** Finds `Contract.member` or `name` among the symbols of one file. */
export function findSymbolByPath(fileSymbols: FileSymbols, symbolPath: string): SourceSymbol | undefined {
  const [first, second] = symbolPath.split(".");
  if (second) {
    const container = fileSymbols.symbols.find((s) => s.name === first);
    return container?.children?.find((child) => child.name === second);
  }
  return flattenSymbols(fileSymbols.symbols).find(({ symbol }) => symbol.name === first)?.symbol;
}
