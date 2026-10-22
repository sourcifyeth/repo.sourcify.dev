"use client";

import { FileNode } from "@/types/codeEditor";
import { ContractPageData } from "@/types/contract";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { EditorProps, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import MonacoEditor from "@monaco-editor/react";
import "@/utils/monacoLoader";
import CodeEditorTabs from "@/components/CodeEditorTabs";
import FileExplorerTree from "@/components/FileExplorerTree";
import SourceToolbar from "@/components/SourceToolbar";
import SourceSidebar, { SidebarView } from "@/components/SourceSidebar";
import SourceSearchPanel, { ActiveSearchMatch } from "@/components/SourceSearchPanel";
import SourceFileFinder, { FinderFile } from "@/components/SourceFileFinder";
import SourceOutline from "@/components/SourceOutline";
import SourceStatusBar from "@/components/SourceStatusBar";
import { sourceShortcuts } from "@/utils/shortcuts";
import { createUtf8Mapper, decodeSourceMap, instructionsInRange } from "@/utils/sourceMap";
import { registerSources, SHOW_IN_BYTECODE_EVENT, ShowInBytecodeDetail } from "@/utils/sourceRegistry";
import ExplorerSections from "@/components/ExplorerSections";
import { useSourceSymbols } from "@/hooks/useSourceSymbols";
import { parseRemappings, resolveImportPath } from "@/utils/importResolution";
import { registerSourceProviders, SourceProviderContext, toMonacoRange } from "@/utils/monacoProviders";
import { SourceSymbol, SymbolRange } from "@/utils/sourceSymbols";
import {
  findSymbolByPath,
  inheritanceChain,
  rankCandidates,
  symbolEntries,
  userTypeResolver,
} from "@/utils/sourceIntelligence";
import { useCodeEditor } from "@/hooks/useCodeEditor";
import { useIsMobile } from "@/hooks/useResponsive";
import { useSourceHash } from "@/hooks/useSourceHash";
import { buildFileTreeWithIds } from "@/utils/fileExplorer";
import { createLibraryPathCheck } from "@/utils/libraryFiles";
import { monacoLanguageOfPath, registerSourceLanguages } from "@/utils/monacoLanguages";
import { formatSourceHash, LineRange, SourceLocation } from "@/utils/sourceHash";
import {
  buildSearchRegExp,
  escapeRegExp,
  lineStarts,
  findMatchesInText,
  searchSources,
  SearchMatch,
  SearchOptions,
} from "@/utils/sourceSearch";

// The search runs this long after the last change to the query or the toggles
const SEARCH_DELAY_MS = 200;
// Upper limit for the match highlights in the open file
const MAX_EDITOR_MATCHES = 10000;

const WORD_WRAP_STORAGE_KEY = "sourceView.wordWrap";

// The lines that a selection covers. A selection that ends at column 1 of a
// later line (a full-line drag) does not include that last line.
function selectionToLines(selection: { startLineNumber: number; endLineNumber: number; endColumn: number }): LineRange {
  const end =
    selection.endLineNumber > selection.startLineNumber && selection.endColumn === 1
      ? selection.endLineNumber - 1
      : selection.endLineNumber;
  return { start: selection.startLineNumber, end };
}

// Scroll the page to the source section, below any bar that sticks to the top
// of the window (marked with `data-sticky-top`, for example the staging banner).
function scrollToSourceSection() {
  const section = document.getElementById("source-code");
  if (!section) return;
  const stickyHeight = Array.from(document.querySelectorAll<HTMLElement>("[data-sticky-top]")).reduce(
    (total, element) => total + element.getBoundingClientRect().height,
    0
  );
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - stickyHeight });
}

function linkFor(location: SourceLocation): string {
  return window.location.origin + window.location.pathname + window.location.search + formatSourceHash(location);
}

const EDITOR_OPTIONS = (isMobile: boolean, wordWrap: boolean): EditorProps["options"] => ({
  readOnly: true,
  minimap: { enabled: isMobile ? false : true },
  scrollBeyondLastLine: false,
  fontSize: isMobile ? 10 : 12,
  wordWrap: wordWrap ? "on" : "off",
  automaticLayout: true,
  scrollbar: {
    useShadows: false,
    verticalHasArrows: true,
    horizontalHasArrows: true,
    vertical: "visible",
    horizontal: "visible",
    verticalScrollbarSize: 12,
    horizontalScrollbarSize: 12,
    alwaysConsumeMouseWheel: true,
  },
  lineNumbers: isMobile ? "off" : "on",
  glyphMargin: true,
  folding: true,
  renderLineHighlight: "all",
  dragAndDrop: false,
});

interface ContractSourceProps {
  contract: ContractPageData;
}

export default function ContractSourceV2({ contract }: ContractSourceProps) {
  const [language, setLanguage] = useState<string>("solidity");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Initialize tabs hook
  const { tabs, activeTabId, activeTab, openTab, closeTab, closeAllTabs, switchToTab } = useCodeEditor({
    initialFiles: contract.sources,
    targetContract: contract.compilation.fullyQualifiedName,
  });

  // File explorer state
  const [fileTreeWithIds, setFileTreeWithIds] = useState<FileNode[]>([]);

  const isMobile = useIsMobile();

  // The files that the compiled contract uses. Other files in `sources` go into the "Other files" group.
  const compiledPaths = useMemo(
    () => (contract.sourceIds ? new Set(Object.keys(contract.sourceIds)) : undefined),
    [contract.sourceIds]
  );
  const remappings = contract.compilation.compilerSettings?.remappings as string[] | undefined;
  const isLibraryPath = useMemo(() => createLibraryPathCheck(remappings ?? []), [remappings]);

  // Build file tree from contract sources
  useEffect(() => {
    const treeWithIds = buildFileTreeWithIds(contract.sources, contract.compilation.fullyQualifiedName, {
      compiledPaths,
      isLibrary: isLibraryPath,
    });
    setFileTreeWithIds(treeWithIds);
  }, [contract.sources, contract.compilation.fullyQualifiedName, compiledPaths, isLibraryPath]);

  // Handle file selection from tree
  const handleFileSelect = (filePath: string, content?: string) => {
    // Open or switch to tab for this file
    if (content) {
      openTab(filePath, content);
    } else if (contract.sources[filePath]) {
      openTab(filePath, contract.sources[filePath].content);
    }
  };

  // Determine language based on file extension
  useEffect(() => {
    if (activeTab) setLanguage(monacoLanguageOfPath(activeTab.path));
  }, [activeTab]);

  // ---- Reader position in the URL hash (#file=…&L=…) ----
  const { location, external, setLocation } = useSourceHash();
  const [editorReady, setEditorReady] = useState(false);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  // Lines to scroll to once the editor shows the right file. Set only by links
  // from outside the editor, so a click on a line number does not scroll.
  const pendingRevealRef = useRef<LineRange | null>(null);
  // A symbol from a link (`sym=Contract.name`), shown once the file's symbols are known
  const pendingSymbolRef = useRef<{ path: string; symbol: string } | null>(null);
  // The file that a link asked for, until its tab is active. While it is set,
  // the hash must not follow the old active tab.
  const pendingFileRef = useRef<string | null>(null);
  const handledExternalRef = useRef(0);
  // Current values for the editor event handlers, which are registered once.
  const activePathRef = useRef<string | undefined>(undefined);
  const locationRef = useRef<SourceLocation | null>(null);
  const anchorLineRef = useRef<number | null>(null);

  useEffect(() => {
    activePathRef.current = activeTab?.path;
    locationRef.current = location;
  });

  // A link (page load, or a hash change from elsewhere) opens the file and asks for the lines
  useEffect(() => {
    if (external === handledExternalRef.current) return;
    handledExternalRef.current = external;
    if (!location?.file) return;
    const source = contract.sources[location.file];
    if (!source) return;
    pendingFileRef.current = location.file;
    pendingRevealRef.current = location.lines ?? null;
    // A byte range (from the bytecode's source map) without lines: reveal the lines it covers
    if (!location.lines && location.range) {
      const mapper = createUtf8Mapper(source.content);
      const starts = lineStarts(source.content);
      const lineAt = (index: number) => starts.filter((start) => start <= index).length;
      pendingRevealRef.current = {
        start: lineAt(mapper.byteToIndex(location.range.start)),
        end: lineAt(Math.max(mapper.byteToIndex(location.range.end) - 1, 0)),
      };
    }
    pendingSymbolRef.current = location.symbol && !location.lines ? { path: location.file, symbol: location.symbol } : null;
    anchorLineRef.current = location.lines?.start ?? null;
    openTab(location.file, source.content);
    scrollToSourceSection();
  }, [external, location, contract.sources, openTab]);

  // The hash follows the open tab. The target file without a hash keeps a clean URL.
  const previousActivePathRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!activeTab) return;
    const tabChanged = previousActivePathRef.current !== activeTab.path;
    previousActivePathRef.current = activeTab.path;
    if (pendingFileRef.current) {
      if (pendingFileRef.current !== activeTab.path) return;
      pendingFileRef.current = null;
    }
    if (location && !location.file) return; // a location without a file (a symbol link) is not ours to replace
    if (location?.file === activeTab.path) return;
    // No source position in the hash: keep the URL clean for the target file, and keep a
    // plain anchor (such as #abi) unless the user switches to another tab
    if (!location && (activeTab.isTargetContract || !tabChanged)) return;
    setLocation({ file: activeTab.path });
  }, [activeTab, location, setLocation]);

  // Highlight the selected lines, and scroll to them if a link asked for it
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorReady || !editorInstance || !monaco || !activeTab) return;
    const model = editorInstance.getModel();
    if (!decorationsRef.current) decorationsRef.current = editorInstance.createDecorationsCollection();
    const here = location?.file === activeTab.path ? location : null;
    const lines = here?.lines;
    // A byte range from a source map (UTF-8 offsets) becomes an exact editor range
    let exactRange: InstanceType<Monaco["Range"]> | null = null;
    if (here?.range && model) {
      const mapper = createUtf8Mapper(activeTab.content);
      const from = model.getPositionAt(mapper.byteToIndex(here.range.start));
      const to = model.getPositionAt(mapper.byteToIndex(here.range.end));
      exactRange = new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column);
    }
    if ((!lines && !exactRange) || !model) {
      decorationsRef.current.clear();
      return;
    }
    const decorations: editor.IModelDeltaDecoration[] = [];
    if (lines) {
      const lineCount = model.getLineCount();
      decorations.push({
        range: new monaco.Range(Math.min(lines.start, lineCount), 1, Math.min(lines.end, lineCount), 1),
        options: {
          isWholeLine: true,
          className: "source-line-highlight",
          linesDecorationsClassName: "source-line-highlight-gutter",
        },
      });
    }
    if (exactRange) {
      decorations.push({
        range: exactRange,
        options: { className: "source-range-highlight", linesDecorationsClassName: "source-range-highlight-gutter" },
      });
    }
    decorationsRef.current.set(decorations);
    if (pendingRevealRef.current) {
      const pending = pendingRevealRef.current;
      pendingRevealRef.current = null;
      if (exactRange) {
        editorInstance.revealRangeInCenter(exactRange);
        editorInstance.setPosition({ lineNumber: exactRange.startLineNumber, column: exactRange.startColumn });
      } else {
        editorInstance.revealLinesInCenter(pending.start, pending.end);
        editorInstance.setPosition({ lineNumber: pending.start, column: 1 });
      }
    }
  }, [editorReady, activeTab, location]);

  // The bytecode sections read the sources from this shared store (see sourceRegistry.ts)
  useEffect(() => registerSources(contract.sources), [contract.sources]);

  // The link to copy: the selected lines if any, else the editor selection, else the file
  const getLink = useCallback((): string => {
    const path = activeTab?.path;
    if (!path) return linkFor({});
    let next: SourceLocation = { file: path };
    if (location?.file === path && location.lines) {
      next = { file: path, lines: location.lines };
    } else {
      const selection = editorRef.current?.getSelection();
      if (selection && !selection.isEmpty()) next = { file: path, lines: selectionToLines(selection) };
    }
    setLocation(next);
    return linkFor(next);
  }, [activeTab?.path, location, setLocation]);

  // ---- Word wrap (remembered per browser) ----
  const [wordWrap, setWordWrap] = useState(true);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WORD_WRAP_STORAGE_KEY);
      if (stored !== null) setWordWrap(stored === "on");
    } catch {
      // Storage can be blocked; the default stays.
    }
  }, []);
  const toggleWordWrap = () => {
    setWordWrap((previous) => {
      try {
        window.localStorage.setItem(WORD_WRAP_STORAGE_KEY, previous ? "off" : "on");
      } catch {
        // Storage can be blocked; the toggle still works for this page view.
      }
      return !previous;
    });
  };

  const editorOptions = useMemo(() => EDITOR_OPTIONS(isMobile, wordWrap), [isMobile, wordWrap]);

  // ---- Search across all files ----
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    query: "",
    matchCase: false,
    wholeWord: false,
    regex: false,
  });
  // The options that the search uses: they follow `searchOptions` after a short pause in typing
  const [appliedSearch, setAppliedSearch] = useState<SearchOptions>(searchOptions);
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(searchOptions), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchOptions]);

  const targetPath = contract.compilation.fullyQualifiedName.substring(
    0,
    contract.compilation.fullyQualifiedName.lastIndexOf(":")
  );
  const searchRegExp = useMemo(() => buildSearchRegExp(appliedSearch), [appliedSearch]);
  const searchError = searchRegExp && !(searchRegExp instanceof RegExp) ? searchRegExp.error : null;
  const searchResult = useMemo(
    () => (searchRegExp instanceof RegExp ? searchSources(contract.sources, searchRegExp, { firstPath: targetPath }) : null),
    [searchRegExp, contract.sources, targetPath]
  );

  const [activeMatch, setActiveMatch] = useState<ActiveSearchMatch | null>(null);
  useEffect(() => setActiveMatch(null), [searchRegExp]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);
  useEffect(() => {
    if (searchFocusRequest === 0) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [searchFocusRequest]);

  // Show the search view and focus its box. A selected text becomes the query
  // (escaped if Regex is on, so that it still finds the literal text).
  const openSearch = useCallback((query?: string) => {
    setSidebarView("search");
    if (query) {
      setSearchOptions((previous) => ({ ...previous, query: previous.regex ? escapeRegExp(query) : query }));
    }
    setSearchFocusRequest((count) => count + 1);
  }, []);
  // The Monaco command is registered once, so it calls the current function through a ref
  const openSearchRef = useRef(openSearch);
  useEffect(() => {
    openSearchRef.current = openSearch;
  }, [openSearch]);

  const changeSidebarView = (view: SidebarView) => {
    if (view === "search") openSearch();
    else setSidebarView(view);
  };

  // Open a file and select a range in it: a search result, or a symbol from Go to file
  const [revealRequest, setRevealRequest] = useState<{ path: string; range: SymbolRange; id: number } | null>(null);
  const handledRevealRef = useRef(0);
  const openFileAtRange = (path: string, range: SymbolRange) => {
    const source = contract.sources[path];
    if (!source) return;
    openTab(path, source.content);
    setRevealRequest((previous) => ({ path, range, id: (previous?.id ?? 0) + 1 }));
  };
  const openSearchMatch = (path: string, match: SearchMatch) => {
    setActiveMatch({ path, match });
    openFileAtRange(path, match);
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorReady || !editorInstance || !monaco || !activeTab || !revealRequest) return;
    if (revealRequest.id === handledRevealRef.current || revealRequest.path !== activeTab.path) return;
    handledRevealRef.current = revealRequest.id;
    const range = toMonacoRange(revealRequest.range);
    editorInstance.setSelection(range);
    editorInstance.revealRangeInCenter(range);
  }, [editorReady, activeTab, revealRequest]);

  // While the search view shows, highlight every match in the open file,
  // also in the minimap and in the scrollbar
  const searchDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorReady || !editorInstance || !monaco) return;
    if (!searchDecorationsRef.current) searchDecorationsRef.current = editorInstance.createDecorationsCollection();
    if (sidebarView !== "search" || !(searchRegExp instanceof RegExp) || !activeTab) {
      searchDecorationsRef.current.clear();
      return;
    }
    const matchColor = "rgba(245, 158, 11, 0.85)";
    const matches = findMatchesInText(activeTab.content, searchRegExp, MAX_EDITOR_MATCHES);
    searchDecorationsRef.current.set(
      matches.map((match) => {
        const isActive =
          activeMatch?.path === activeTab.path &&
          activeMatch.match.startLine === match.startLine &&
          activeMatch.match.startColumn === match.startColumn;
        return {
          range: new monaco.Range(match.startLine, match.startColumn, match.endLine, match.endColumn),
          options: {
            className: isActive ? "source-search-match-active" : "source-search-match",
            overviewRuler: { color: matchColor, position: monaco.editor.OverviewRulerLane.Center },
            minimap: { color: matchColor, position: monaco.editor.MinimapPosition.Inline },
          },
        };
      })
    );
  }, [editorReady, activeTab, searchRegExp, sidebarView, activeMatch]);

  // ---- Go to file (Cmd/Ctrl+P) ----
  const [finderOpen, setFinderOpen] = useState(false);
  const finderFiles = useMemo<FinderFile[]>(
    () =>
      Object.keys(contract.sources).map((path) => ({
        path,
        isLibrary: isLibraryPath(path),
        isCompiled: !compiledPaths || compiledPaths.size === 0 || compiledPaths.has(path),
      })),
    [contract.sources, isLibraryPath, compiledPaths]
  );
  const openFinder = useCallback(() => setFinderOpen(true), []);
  const openFinderRef = useRef(openFinder);
  useEffect(() => {
    openFinderRef.current = openFinder;
  }, [openFinder]);
  const closeFinder = () => {
    setFinderOpen(false);
    editorRef.current?.focus();
  };
  const openFileFromFinder = (path: string) => {
    setFinderOpen(false);
    handleFileSelect(path);
    editorRef.current?.focus();
  };

  // ---- Fullscreen: the source view fills the window ----
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Monaco context key, so that the editor's own Esc command knows about fullscreen
  const fullscreenContextKeyRef = useRef<editor.IContextKey<boolean> | null>(null);
  useEffect(() => {
    fullscreenContextKeyRef.current?.set(isFullscreen);
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Esc leaves fullscreen, unless something else (a search box, a popover) used it.
    // Monaco marks every Esc as used, so the editor has its own command (see the mount handler).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  // ---- Symbols: outline, "Go to symbol", "@" and "#" in Go to file ----
  const symbolIndex = useSourceSymbols(contract.sources);
  const activePath = activeTab?.path;
  const requestSymbols = symbolIndex.request;
  useEffect(() => {
    if (activePath) requestSymbols(activePath);
  }, [activePath, requestSymbols]);
  const activeFileSymbols = activePath ? symbolIndex.get(activePath) : undefined;

  // The cursor position: the outline marks the symbol that holds it, and the status bar shows it
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | null>(null);
  const cursorLine = cursorPosition?.line ?? null;

  // A click in the outline selects the name of the symbol and shows it, but keeps the focus in the outline
  const revealSymbol = (symbol: SourceSymbol) => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    const range = toMonacoRange(symbol.nameRange);
    editorInstance.setSelection(range);
    editorInstance.revealRangeInCenterIfOutsideViewport(range);
  };

  const openSymbolFromFinder = (path: string, symbol: SourceSymbol) => {
    setFinderOpen(false);
    openFileAtRange(path, symbol.nameRange);
    editorRef.current?.focus();
  };

  // Import paths resolve with the remappings, among the source files
  const sourcePaths = useMemo(() => new Set(Object.keys(contract.sources)), [contract.sources]);
  const parsedRemappings = useMemo(() => parseRemappings(remappings ?? []), [remappings]);

  // The Monaco providers are registered once; they read the current data through this ref
  const modelPathsRef = useRef(new Map<string, string>());
  const providerContextRef = useRef<SourceProviderContext | null>(null);
  // The compiled files (the files of `sourceIds`), main file first. Without that list: all files.
  const compiledPathList = useMemo(() => {
    const paths = compiledPaths && compiledPaths.size > 0 ? [...compiledPaths] : Object.keys(contract.sources);
    return [...paths.filter((path) => path === targetPath), ...paths.filter((path) => path !== targetPath)];
  }, [compiledPaths, contract.sources, targetPath]);
  const targetContractName = contract.compilation.fullyQualifiedName.split(":").pop() ?? "";

  // The symbols of all compiled files, read once (in the worker) and kept
  const compiledSymbolsRef = useRef<ReturnType<SourceProviderContext["compiledSymbols"]> | null>(null);
  const compiledSymbols = () => {
    if (!compiledSymbolsRef.current) {
      compiledSymbolsRef.current = Promise.all(compiledPathList.map((path) => symbolIndex.request(path))).then(
        (results) => {
          const entries = symbolEntries(new Map(compiledPathList.map((path, i) => [path, results[i]])));
          return { entries, resolve: userTypeResolver(entries), chain: inheritanceChain(entries, targetContractName) };
        }
      );
    }
    return compiledSymbolsRef.current;
  };

  useEffect(() => {
    providerContextRef.current = {
      pathOfModel: (model) => modelPathsRef.current.get(model.uri.toString()),
      pathOfUri: (uri) => modelPathsRef.current.get(uri.toString()),
      requestSymbols: symbolIndex.request,
      importTarget: (fromPath, importPath) => resolveImportPath(importPath, fromPath, sourcePaths, parsedRemappings),
      openFile: (path) => {
        handleFileSelect(path);
        editorRef.current?.focus();
      },
      openFileAtRange: (path, range) => {
        openFileAtRange(path, range);
        editorRef.current?.focus();
      },
      compiledSymbols,
      compiledPaths: () => compiledPathList,
      compiler: () => ({
        targetContract: targetContractName,
        signatures: contract.signatures,
        userdoc: contract.userdoc,
        devdoc: contract.devdoc,
      }),
      readContent: (path) => contract.sources[path]?.content ?? "",
      uriFor: (path) => {
        const monaco = monacoRef.current!;
        const uri = monaco.Uri.parse(path);
        if (!monaco.editor.getModel(uri)) {
          monaco.editor.createModel(contract.sources[path]?.content ?? "", monacoLanguageOfPath(path), uri);
        }
        return uri;
      },
      copyText: (text) => {
        navigator.clipboard.writeText(text).catch((error) => console.error("Failed to copy:", error));
      },
    };
  });

  // A link with `sym=` waits for the file's symbols, then highlights and shows the declaration
  const showDeclaration = useCallback(
    (path: string, symbolPath: string, symbol: SourceSymbol) => {
      const lines = { start: symbol.range.startLine, end: symbol.range.endLine };
      if (path !== activePath && contract.sources[path]) {
        pendingFileRef.current = path;
        openTab(path, contract.sources[path].content);
      }
      pendingRevealRef.current = lines;
      setLocation({ file: path, symbol: symbolPath, lines });
    },
    [activePath, contract.sources, openTab, setLocation]
  );
  useEffect(() => {
    const pending = pendingSymbolRef.current;
    if (!pending || pending.path !== activePath || !activeFileSymbols) return;
    pendingSymbolRef.current = null;
    const symbol = findSymbolByPath(activeFileSymbols, pending.symbol);
    if (symbol) {
      showDeclaration(pending.path, pending.symbol, symbol);
      return;
    }
    // A storage layout names the compiled contract even for variables that a base
    // contract declares (for example `locked` from ReentrancyGuard). Look in the bases.
    const name = pending.symbol.split(".").pop()!;
    compiledSymbols().then(({ entries, chain }) => {
      const variables = entries.filter((e) => e.symbol.kind === "stateVariable" || e.symbol.kind === "constant");
      const found = rankCandidates(variables, name, pending.path, chain)[0];
      if (found) showDeclaration(found.path, found.container ? `${found.container.name}.${name}` : name, found.symbol);
    });
    // `external`: a new link to the file that is already open must run this too.
    // compiledSymbols reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, activeFileSymbols, showDeclaration, external]);
  const providersRef = useRef<{ dispose: () => void } | null>(null);
  useEffect(() => () => providersRef.current?.dispose(), []);

  // Shortcuts while the focus is in the source section but outside the editor
  // (the editor has its own commands, registered on mount): Cmd/Ctrl+Shift+F
  // opens the search, Cmd/Ctrl+Shift+O "Go to symbol", Cmd/Ctrl+P Go to file.
  const onSourceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (editorRef.current?.hasTextFocus()) return;
    if (event.shiftKey && event.code === "KeyF") {
      event.preventDefault();
      openSearch();
    } else if (event.shiftKey && event.code === "KeyO" && editorRef.current) {
      event.preventDefault();
      goToSymbol();
    } else if (!event.shiftKey && event.code === "KeyP") {
      event.preventDefault();
      openFinder();
    }
  };

  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  const shortcuts = useMemo(() => sourceShortcuts(isMac), [isMac]);

  // The "?" sheet with all shortcuts; the toolbar button and the status bar open it
  const [helpOpen, setHelpOpen] = useState(false);

  // A short message in the status bar, for example when "Show in Bytecode" finds nothing
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashStatus = (message: string) => {
    setStatusMessage(message);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 4000);
  };
  useEffect(() => () => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
  }, []);

  // "Show in Bytecode": the instructions whose source range lies inside the selected lines
  const showInBytecode = (selection: { startLineNumber: number; endLineNumber: number; endColumn: number } | null) => {
    const path = activePathRef.current;
    if (!path || !selection) return;
    const fileIndex = contract.sourceIds?.[path]?.id;
    if (fileIndex === undefined) {
      flashStatus("This file is not part of the compilation, so no bytecode comes from it.");
      return;
    }
    const content = contract.sources[path]?.content ?? "";
    const lines = selectionToLines(selection);
    const starts = lineStarts(content);
    const mapper = createUtf8Mapper(content);
    const startByte = mapper.indexToByte(starts[lines.start - 1] ?? content.length);
    const endByte = mapper.indexToByte(lines.end < starts.length ? starts[lines.end] : content.length);
    const count = (sourceMap?: string) =>
      sourceMap ? instructionsInRange(decodeSourceMap(sourceMap), fileIndex, startByte, endByte).length : 0;
    const runtime = count(contract.runtimeBytecode?.sourceMap);
    const creation = count(contract.creationBytecode?.sourceMap);
    const name = path.split("/").pop();
    const label = lines.start === lines.end ? `${name} line ${lines.start}` : `${name} lines ${lines.start}–${lines.end}`;
    if (runtime === 0 && creation === 0) {
      flashStatus(`No bytecode instruction comes only from ${label}.`);
      return;
    }
    // Leave fullscreen, so that the page can scroll to the bytecode
    setIsFullscreen(false);
    const detail: ShowInBytecodeDetail = { path, startByte, endByte, label, target: runtime > 0 ? "runtime" : "creation" };
    window.dispatchEvent(new CustomEvent(SHOW_IN_BYTECODE_EVENT, { detail }));
  };
  const showInBytecodeRef = useRef(showInBytecode);
  useEffect(() => {
    showInBytecodeRef.current = showInBytecode;
  });

  // Monaco's "Go to symbol" list for the open file
  const goToSymbol = () => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;
    editorInstance.focus();
    editorInstance.trigger("keyboard", "editor.action.quickOutline", null);
  };

  // Handle editor mounting
  const handleEditorDidMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // The line-number column and the glyph margin left of it (where the link icon shows) are both clickable
    const isLineGutter = (type: editor.MouseTargetType) =>
      type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
      type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;

    // While the pointer is over a line number: a link icon in the margin and a faint row highlight,
    // so that the user sees that a click selects the line
    const hoverDecorations = editorInstance.createDecorationsCollection();
    let hoveredLine: number | null = null;
    const clearHover = () => {
      if (hoveredLine === null) return;
      hoveredLine = null;
      hoverDecorations.clear();
    };
    editorInstance.onMouseMove((event) => {
      const line = isLineGutter(event.target.type) ? event.target.position?.lineNumber ?? null : null;
      if (line === hoveredLine) return;
      if (line === null) {
        clearHover();
        return;
      }
      hoveredLine = line;
      hoverDecorations.set([
        {
          range: new monaco.Range(line, 1, line, 1),
          options: { isWholeLine: true, className: "source-line-hover", glyphMarginClassName: "source-line-link-icon" },
        },
      ]);
    });
    editorInstance.onMouseLeave(clearHover);
    // A model change removes the decorations, so forget the hovered line too
    editorInstance.onDidChangeModel(() => {
      hoveredLine = null;
    });

    // A click on a line number selects that line; Shift+click extends the selection to a range
    editorInstance.onMouseDown((event) => {
      if (!isLineGutter(event.target.type)) return;
      const line = event.target.position?.lineNumber;
      const path = activePathRef.current;
      if (!line || !path) return;
      const anchor = anchorLineRef.current;
      const sameFile = locationRef.current?.file === path;
      if (event.event.shiftKey && anchor !== null && sameFile) {
        setLocation({ file: path, lines: { start: Math.min(anchor, line), end: Math.max(anchor, line) } });
      } else {
        anchorLineRef.current = line;
        setLocation({ file: path, lines: { start: line, end: line } });
      }
    });

    editorInstance.addAction({
      id: "sourcify.copyLinkToSelection",
      label: "Copy Link to Selected Lines",
      contextMenuGroupId: "9_cutcopypaste",
      contextMenuOrder: 10,
      run: async (ed) => {
        const path = activePathRef.current;
        const selection = ed.getSelection();
        if (!path || !selection) return;
        const lines = selectionToLines(selection);
        anchorLineRef.current = lines.start;
        const next = { file: path, lines };
        setLocation(next);
        try {
          await navigator.clipboard.writeText(linkFor(next));
        } catch (error) {
          console.error("Failed to copy:", error);
        }
      },
    });

    // Cmd/Ctrl+Shift+F opens the search across all files. Ctrl/Cmd+F stays the find in this file.
    // Actions (not only commands) also show in the right-click menu, with their shortcut.
    editorInstance.addAction({
      id: "sourcify.searchAllFiles",
      label: "Search in All Files",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 2,
      run: (ed) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        const selectedText =
          selection && model && !selection.isEmpty() && selection.startLineNumber === selection.endLineNumber
            ? model.getValueInRange(selection)
            : "";
        openSearchRef.current(selectedText);
      },
    });

    // In fullscreen, Esc in the editor leaves fullscreen, but only when Monaco does not need Esc
    // itself: no find widget or suggestion list is open, and there is no selection to clear.
    fullscreenContextKeyRef.current = editorInstance.createContextKey("sourceFullscreen", false);
    editorInstance.addCommand(
      monaco.KeyCode.Escape,
      () => setIsFullscreen(false),
      "sourceFullscreen && !findWidgetVisible && !suggestWidgetVisible && !editorHasSelection && !editorHasMultipleSelections"
    );

    editorInstance.addAction({
      id: "sourcify.showInBytecode",
      label: "Show in Bytecode",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 3,
      run: (ed) => showInBytecodeRef.current(ed.getSelection()),
    });

    // Cmd/Ctrl+P opens Go to file (instead of the browser's Print while the editor has the focus)
    editorInstance.addAction({
      id: "sourcify.goToFile",
      label: "Go to File…",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      contextMenuGroupId: "navigation",
      contextMenuOrder: 1,
      run: () => openFinderRef.current(),
    });

    // The outline follows the cursor
    editorInstance.onDidChangeCursorPosition((event) =>
      setCursorPosition({ line: event.position.lineNumber, column: event.position.column })
    );

    // Symbols for "Go to symbol" and links on import paths. The models of the
    // source files are named by their path (the `path` prop of the editor).
    modelPathsRef.current = new Map(Object.keys(contract.sources).map((path) => [monaco.Uri.parse(path).toString(), path]));
    providersRef.current?.dispose();
    providersRef.current = registerSourceProviders(monaco, () => providerContextRef.current!);

    setEditorReady(true);
  };


  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[60] flex flex-col bg-gray-800"
          : "bg-white shadow overflow-hidden sm:rounded-lg"
      }
      onKeyDown={onSourceKeyDown}
      role={isFullscreen ? "dialog" : undefined}
      aria-modal={isFullscreen || undefined}
      aria-label={isFullscreen ? "Source code, fullscreen" : undefined}
    >
      {/* Desktop height: about 75% of the window, at least 540 px. Fullscreen: the whole window. */}
      <div
        className={`relative flex flex-col md:flex-row border-t border-gray-200 ${
          isFullscreen ? "flex-1 min-h-0" : "md:h-[max(540px,75vh)]"
        }`}
      >
        {/* File Explorer */}
        <div className="w-full md:w-1/4 md:h-full border-b md:border-b-0 md:border-r border-gray-700">
          <SourceSidebar
            view={sidebarView}
            onViewChange={changeSidebarView}
            searchShortcut={shortcuts.searchAll}
            explorer={
              <ExplorerSections
                outlineOpenByDefault={!isMobile}
                files={
                  <FileExplorerTree
                    files={fileTreeWithIds}
                    fileCount={Object.keys(contract.sources).length}
                    activeFile={activeTab?.path}
                    onFileSelect={handleFileSelect}
                  />
                }
                outline={
                  <SourceOutline
                    path={activePath}
                    fileSymbols={activeFileSymbols}
                    cursorLine={cursorLine}
                    onSelect={revealSymbol}
                  />
                }
              />
            }
            search={
              <SourceSearchPanel
                options={searchOptions}
                onOptionsChange={setSearchOptions}
                result={searchResult}
                error={searchError}
                fileCount={Object.keys(contract.sources).length}
                activeMatch={activeMatch}
                onOpenMatch={openSearchMatch}
                onEscape={() => editorRef.current?.focus()}
                inputRef={searchInputRef}
              />
            }
          />
        </div>
        {/* Source code editor */}
        <div className={`w-full md:w-3/4 md:h-full flex flex-col min-h-0 ${isFullscreen ? "flex-1" : ""}`}>
          {/* Code Editor Tabs */}
          <CodeEditorTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={switchToTab}
            onTabClose={closeTab}
            onTabCloseAll={closeAllTabs}
          />
          {activeTab && (
            <SourceToolbar
              path={activeTab.path}
              getLink={getLink}
              fileContent={activeTab.content}
              wordWrap={wordWrap}
              onToggleWordWrap={toggleWordWrap}
              onOpenFinder={openFinder}
              shortcuts={shortcuts}
              helpOpen={helpOpen}
              onHelpOpenChange={setHelpOpen}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((value) => !value)}
            />
          )}
          {/* Monaco Editor */}
          <div className={`source-editor relative min-h-0 md:flex-1 ${isFullscreen ? "flex-1" : "h-[500px] md:h-auto"}`}>
            {activeTab ? (
              <MonacoEditor
                className="editor-container"
                height="100%"
                language={language}
                path={activeTab.path}
                defaultValue={activeTab.content}
                options={editorOptions}
                beforeMount={registerSourceLanguages}
                onMount={handleEditorDidMount}
                loading={
                  <div className="bg-gray-800 text-sm text-gray-500 flex items-center justify-center w-full h-full">
                    <p>Loading files...</p>
                  </div>
                }
                theme="vs-dark"
              />
            ) : (
              <div className="bg-gray-800 p-4 text-sm text-gray-500 flex items-center justify-center w-full h-full">
                <p>No source files available.</p>
              </div>
            )}
          </div>
          {activeTab && (
            <SourceStatusBar
              line={cursorPosition?.line ?? null}
              column={cursorPosition?.column ?? null}
              language={language}
              shortcuts={shortcuts}
              onGoToFile={openFinder}
              onSearchAll={() => openSearch()}
              onGoToSymbol={goToSymbol}
              onOpenHelp={() => setHelpOpen(true)}
              message={statusMessage}
            />
          )}
        </div>
        {finderOpen && (
          <SourceFileFinder
            files={finderFiles}
            shortcut={shortcuts.goToFile}
            onOpen={openFileFromFinder}
            activePath={activePath}
            getSymbols={symbolIndex.get}
            symbolsVersion={symbolIndex.version}
            onRequestSymbols={symbolIndex.requestMany}
            onOpenSymbol={openSymbolFromFinder}
            onClose={closeFinder}
          />
        )}
      </div>
    </div>
  );
}
