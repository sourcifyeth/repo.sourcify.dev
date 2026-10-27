import type { Monaco } from "@monaco-editor/react";
import type { editor, IDisposable, IPosition, IRange, languages, Position, Uri } from "monaco-editor";
import { findImportPaths } from "./importResolution";
import { natSpecToMarkdown } from "./natspec";
import { codeBlock, escapeMarkdown, inlineCode } from "./markdown";
import { UserTypeResolver } from "./selectors";
import {
  CompilerData,
  declarationLine,
  natSpecInfo,
  rankCandidates,
  selectorInfo,
  SelectorInfo,
  SymbolEntry,
} from "./sourceIntelligence";
import { buildSearchRegExp, findMatchesInText } from "./sourceSearch";
import { FileSymbols, maskCommentsAndStrings, SourceSymbol, SymbolRange } from "./sourceSymbols";

/**
 * Monaco features of the source view that need contract data:
 * - document symbols for "Go to symbol" (Cmd/Ctrl+Shift+O) and the breadcrumbs,
 * - links on import paths (Cmd/Ctrl+click opens the imported file in a tab).
 *
 * The providers are registered once and read the current page data through
 * `getContext`, so that they never hold stale data.
 */
export interface SourceProviderContext {
  pathOfModel: (model: editor.ITextModel) => string | undefined;
  pathOfUri: (uri: Uri) => string | undefined;
  requestSymbols: (path: string) => Promise<FileSymbols>;
  importTarget: (fromPath: string, importPath: string) => string | undefined;
  openFile: (path: string) => void;
  openFileAtRange: (path: string, range: SymbolRange) => void;
  // The symbols of all compiled files (read in the background on first use)
  compiledSymbols: () => Promise<{ entries: SymbolEntry[]; resolve: UserTypeResolver; chain: string[] }>;
  compiledPaths: () => string[];
  compiler: () => CompilerData;
  readContent: (path: string) => string;
  // The URI of a file's model; creates the model if no tab has opened the file yet
  uriFor: (path: string) => Uri;
  copyText: (text: string) => void;
}

const COPY_COMMAND = "sourcify.copySelector";
// Upper limit for "Find references"
const MAX_REFERENCES = 1000;

const shortHash = (value: string) => (value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value);

const containsPosition = (range: SymbolRange, position: Position) =>
  (position.lineNumber > range.startLine ||
    (position.lineNumber === range.startLine && position.column >= range.startColumn)) &&
  (position.lineNumber < range.endLine ||
    (position.lineNumber === range.endLine && position.column <= range.endColumn));

// Links use this scheme, so that the link opener knows they are ours
const LINK_SCHEME = "sourcify-source";

export const toMonacoRange = (range: SymbolRange): IRange => ({
  startLineNumber: range.startLine,
  startColumn: range.startColumn,
  endLineNumber: range.endLine,
  endColumn: range.endColumn,
});

function toDocumentSymbols(monaco: Monaco, symbols: SourceSymbol[], isMember = false): languages.DocumentSymbol[] {
  const { SymbolKind } = monaco.languages;
  const kinds: Record<SourceSymbol["kind"], languages.SymbolKind> = {
    contract: SymbolKind.Class,
    abstractContract: SymbolKind.Class,
    interface: SymbolKind.Interface,
    library: SymbolKind.Module,
    function: isMember ? SymbolKind.Method : SymbolKind.Function,
    constructor: SymbolKind.Constructor,
    fallback: SymbolKind.Method,
    receive: SymbolKind.Method,
    modifier: SymbolKind.Method,
    event: SymbolKind.Event,
    error: SymbolKind.Object,
    struct: SymbolKind.Struct,
    enum: SymbolKind.Enum,
    stateVariable: SymbolKind.Field,
    constant: SymbolKind.Constant,
    userType: SymbolKind.TypeParameter,
  };
  return symbols.map((symbol) => ({
    name: symbol.name,
    detail: symbol.detail ?? "",
    kind: kinds[symbol.kind],
    tags: [],
    range: toMonacoRange(symbol.range),
    selectionRange: toMonacoRange(symbol.nameRange),
    children: symbol.children ? toDocumentSymbols(monaco, symbol.children, true) : undefined,
  }));
}

export function registerSourceProviders(monaco: Monaco, getContext: () => SourceProviderContext): IDisposable {
  const disposables: IDisposable[] = [];

  disposables.push(
    monaco.languages.registerDocumentSymbolProvider(["solidity", "vyper"], {
      displayName: "Sourcify symbols",
      provideDocumentSymbols: async (model: editor.ITextModel) => {
        const path = getContext().pathOfModel(model);
        if (!path) return [];
        const { symbols } = await getContext().requestSymbols(path);
        return toDocumentSymbols(monaco, symbols);
      },
    })
  );

  disposables.push(
    monaco.languages.registerLinkProvider("solidity", {
      provideLinks: (model: editor.ITextModel) => {
        const context = getContext();
        const fromPath = context.pathOfModel(model);
        if (!fromPath) return { links: [] };
        const text = model.getValue();
        const masked = maskCommentsAndStrings(text, "solidity");
        const links: languages.ILink[] = [];
        for (const found of findImportPaths(text, masked)) {
          const target = context.importTarget(fromPath, found.path);
          if (!target) continue;
          const start = model.getPositionAt(found.start);
          const end = model.getPositionAt(found.end);
          links.push({
            range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
            url: monaco.Uri.from({ scheme: LINK_SCHEME, path: "/" + encodeURIComponent(target) }),
            tooltip: `Open ${target}`,
          });
        }
        return { links };
      },
    })
  );

  disposables.push(
    monaco.editor.registerLinkOpener({
      open: (resource: Uri) => {
        if (resource.scheme !== LINK_SCHEME) return false;
        getContext().openFile(decodeURIComponent(resource.path.slice(1)));
        return true;
      },
    })
  );

  // ---- Selectors as CodeLens: a click copies the value, and the lens shows "copied" for a moment ----
  let copiedValue: string | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;
  const lensListeners = new Set<(provider: languages.CodeLensProvider) => void>();
  const codeLensProvider: languages.CodeLensProvider = {
    onDidChange: (listener: (provider: languages.CodeLensProvider) => void) => {
      lensListeners.add(listener);
      return { dispose: () => lensListeners.delete(listener) };
    },
    provideCodeLenses: async (model: editor.ITextModel) => {
      const context = getContext();
      const path = context.pathOfModel(model);
      if (!path) return { lenses: [], dispose: () => {} };
      const { entries, resolve, chain } = await context.compiledSymbols();
      const compiler = context.compiler();
      // Files outside the compilation ("Other files") are not in `entries`: read their own symbols
      const fileEntries = entries.some((entry) => entry.path === path)
        ? entries.filter((entry) => entry.path === path)
        : (await context.requestSymbols(path)).symbols.flatMap((symbol) => [
            { path, symbol },
            ...(symbol.children ?? []).map((child) => ({ path, symbol: child, container: symbol })),
          ]);
      const lenses: languages.CodeLens[] = [];
      for (const entry of fileEntries) {
        const info: SelectorInfo | undefined = selectorInfo(entry, compiler, resolve, chain);
        if (!info) continue;
        const line = entry.symbol.range.startLine;
        const shown = info.kind === "topic" ? shortHash(info.value) : info.value;
        lenses.push({
          range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
          command: {
            id: COPY_COMMAND,
            // "$(name)" is a Monaco codicon: a copy icon shows that a click copies
            title: copiedValue === info.value ? `$(check) copied ${shown}` : `$(copy) ${info.kind} ${shown}`,
            tooltip: `${info.signature}. Click to copy. ${
              info.fromCompiler ? "From the compiler's ABI." : "Computed from the canonical signature."
            }`,
            arguments: [info.value],
          },
        });
      }
      return { lenses, dispose: () => {} };
    },
  };
  disposables.push(monaco.languages.registerCodeLensProvider(["solidity", "vyper"], codeLensProvider));
  disposables.push(
    monaco.editor.registerCommand(COPY_COMMAND, (_accessor: unknown, value: string) => {
      getContext().copyText(value);
      copiedValue = value;
      lensListeners.forEach((listener) => listener(codeLensProvider));
      if (copiedTimer) clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copiedValue = null;
        lensListeners.forEach((listener) => listener(codeLensProvider));
        // Monaco redraws CodeLens lines after a short delay, so keep "copied" long enough to be seen
      }, 2500);
    })
  );

  // The declarations that the name under the cursor means: the declaration itself
  // if the cursor is on its name, else every declaration with that name (best guess)
  const lookUp = async (model: editor.ITextModel, position: Position) => {
    const context = getContext();
    const path = context.pathOfModel(model);
    const word = model.getWordAtPosition(position);
    if (!path || !word) return null;
    const { entries, resolve, chain } = await context.compiledSymbols();
    const own = entries.find((entry) => entry.path === path && containsPosition(entry.symbol.nameRange, position));
    const candidates = own ? [own] : rankCandidates(entries, word.word, path, chain);
    if (candidates.length === 0) return null;
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    return { context, path, word: word.word, range, candidates, isDeclaration: !!own, resolve, chain };
  };

  // ---- Hover: declaration, selector and NatSpec ----
  disposables.push(
    monaco.languages.registerHoverProvider(["solidity", "vyper"], {
      provideHover: async (model: editor.ITextModel, position: Position) => {
        const found = await lookUp(model, position);
        if (!found) return null;
        const { context, path, word, range, candidates, isDeclaration, resolve, chain } = found;
        const entry = candidates[0];
        const compiler = context.compiler();
        const info = selectorInfo(entry, compiler, resolve, chain);
        const docs = natSpecInfo(
          entry,
          context.readContent(entry.path),
          compiler,
          info,
          candidates,
          context.readContent
        );
        const language = entry.path.endsWith(".vy") ? "vyper" : "solidity";
        // Names, paths and the declaration come from the contract: code spans or escaped text only
        const where = escapeMarkdown(entry.container ? `${entry.container.name} · ${entry.path}` : entry.path);
        const contents: { value: string }[] = [{ value: codeBlock(language, declarationLine(entry.symbol)) }];
        if (info) contents.push({ value: `${info.kind} ${inlineCode(info.value)} · ${inlineCode(info.signature)}` });
        const markdown = docs ? natSpecToMarkdown(docs) : "";
        if (markdown) {
          const from =
            docs?.source === "compiler"
              ? "from the compiler output (userdoc and devdoc)"
              : docs?.source === "docstring"
                ? "from the docstring"
                : "from the doc comment above the declaration";
          contents.push({ value: `**NatSpec** · *${from}*\n\n${markdown}` });
        }
        const notes: string[] = [];
        if (!isDeclaration || entry.path !== path) notes.push(`Declared in ${where}`);
        if (!isDeclaration && candidates.length > 1) {
          notes.push(
            `Best guess by name: ${candidates.length} declarations are named ${inlineCode(word)}. Cmd/Ctrl+click lists them all.`
          );
        }
        if (notes.length) contents.push({ value: notes.map((note) => `*${note}*`).join("  \n") });
        return { range, contents };
      },
    })
  );

  // ---- Go to definition (best guess, by name) and Find references (whole-word text search) ----
  disposables.push(
    monaco.languages.registerDefinitionProvider(["solidity", "vyper"], {
      provideDefinition: async (model: editor.ITextModel, position: Position) => {
        const found = await lookUp(model, position);
        if (!found) return null;
        return found.candidates.map((entry) => ({
          uri: found.context.uriFor(entry.path),
          range: toMonacoRange(entry.symbol.nameRange),
        }));
      },
    })
  );
  disposables.push(
    monaco.languages.registerReferenceProvider(["solidity", "vyper"], {
      provideReferences: (model: editor.ITextModel, position: Position) => {
        const context = getContext();
        const word = model.getWordAtPosition(position);
        if (!word) return [];
        const regExp = buildSearchRegExp({ query: word.word, matchCase: true, wholeWord: true, regex: false });
        if (!(regExp instanceof RegExp)) return [];
        const locations: languages.Location[] = [];
        for (const path of context.compiledPaths()) {
          const remaining = MAX_REFERENCES - locations.length;
          if (remaining <= 0) break;
          for (const match of findMatchesInText(context.readContent(path), regExp, remaining)) {
            locations.push({ uri: context.uriFor(path), range: toMonacoRange(match) });
          }
        }
        return locations;
      },
    })
  );

  // A jump into another file (from go to definition or the references list) opens it in a tab
  disposables.push(
    monaco.editor.registerEditorOpener({
      openCodeEditor: (_source: editor.ICodeEditor, resource: Uri, selectionOrPosition?: IRange | IPosition) => {
        const context = getContext();
        const path = context.pathOfUri(resource);
        if (!path) return false;
        const start =
          selectionOrPosition && "startLineNumber" in selectionOrPosition
            ? { line: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
            : selectionOrPosition
              ? { line: selectionOrPosition.lineNumber, column: selectionOrPosition.column }
              : { line: 1, column: 1 };
        const end =
          selectionOrPosition && "endLineNumber" in selectionOrPosition
            ? { line: selectionOrPosition.endLineNumber, column: selectionOrPosition.endColumn }
            : start;
        context.openFileAtRange(path, {
          startLine: start.line,
          startColumn: start.column,
          endLine: end.line,
          endColumn: end.column,
        });
        return true;
      },
    })
  );

  return {
    dispose: () => {
      if (copiedTimer) clearTimeout(copiedTimer);
      disposables.forEach((disposable) => disposable.dispose());
    },
  };
}
