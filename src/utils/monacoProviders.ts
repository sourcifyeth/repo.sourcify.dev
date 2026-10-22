import type { Monaco } from "@monaco-editor/react";
import type { editor, IDisposable, IRange, languages, Uri } from "monaco-editor";
import { findImportPaths } from "./importResolution";
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
  requestSymbols: (path: string) => Promise<FileSymbols>;
  importTarget: (fromPath: string, importPath: string) => string | undefined;
  openFile: (path: string) => void;
}

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

  return { dispose: () => disposables.forEach((disposable) => disposable.dispose()) };
}
