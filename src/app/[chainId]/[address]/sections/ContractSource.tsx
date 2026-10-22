"use client";

import { FileNode } from "@/types/codeEditor";
import { ContractData } from "@/types/contract";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { EditorProps, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import MonacoEditor from "@monaco-editor/react";
import CodeEditorTabs from "@/components/CodeEditorTabs";
import FileExplorerTree from "@/components/FileExplorerTree";
import SourceToolbar from "@/components/SourceToolbar";
import SourceSidebar, { SidebarView } from "@/components/SourceSidebar";
import SourceSearchPanel, { ActiveSearchMatch } from "@/components/SourceSearchPanel";
import SourceFileFinder, { FinderFile } from "@/components/SourceFileFinder";
import SourceOutline from "@/components/SourceOutline";
import ExplorerSections from "@/components/ExplorerSections";
import { useSourceSymbols } from "@/hooks/useSourceSymbols";
import { parseRemappings, resolveImportPath } from "@/utils/importResolution";
import { registerSourceProviders, SourceProviderContext, toMonacoRange } from "@/utils/monacoProviders";
import { SourceSymbol, SymbolRange } from "@/utils/sourceSymbols";
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
  contract: ContractData;
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
    anchorLineRef.current = location.lines?.start ?? null;
    openTab(location.file, source.content);
    scrollToSourceSection();
  }, [external, location, contract.sources, openTab]);

  // The hash follows the open tab. The target file without a hash keeps a clean URL.
  useEffect(() => {
    if (!activeTab) return;
    if (pendingFileRef.current) {
      if (pendingFileRef.current !== activeTab.path) return;
      pendingFileRef.current = null;
    }
    if (location && !location.file) return; // a location without a file (a symbol link) is not ours to replace
    if (location?.file === activeTab.path) return;
    if (!location && activeTab.isTargetContract) return;
    setLocation({ file: activeTab.path });
  }, [activeTab, location, setLocation]);

  // Highlight the selected lines, and scroll to them if a link asked for it
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorReady || !editorInstance || !monaco || !activeTab) return;
    const model = editorInstance.getModel();
    if (!decorationsRef.current) decorationsRef.current = editorInstance.createDecorationsCollection();
    const lines = location?.file === activeTab.path ? location.lines : undefined;
    if (!lines || !model) {
      decorationsRef.current.clear();
      return;
    }
    const lineCount = model.getLineCount();
    const start = Math.min(lines.start, lineCount);
    const end = Math.min(lines.end, lineCount);
    decorationsRef.current.set([
      {
        range: new monaco.Range(start, 1, end, 1),
        options: {
          isWholeLine: true,
          className: "source-line-highlight",
          linesDecorationsClassName: "source-line-highlight-gutter",
        },
      },
    ]);
    if (pendingRevealRef.current) {
      pendingRevealRef.current = null;
      editorInstance.revealLinesInCenter(start, end);
      editorInstance.setPosition({ lineNumber: start, column: 1 });
    }
  }, [editorReady, activeTab, location]);

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

  // The line of the cursor, so that the outline can mark the symbol that holds it
  const [cursorLine, setCursorLine] = useState<number | null>(null);

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
  useEffect(() => {
    providerContextRef.current = {
      pathOfModel: (model) => modelPathsRef.current.get(model.uri.toString()),
      requestSymbols: symbolIndex.request,
      importTarget: (fromPath, importPath) => resolveImportPath(importPath, fromPath, sourcePaths, parsedRemappings),
      openFile: (path) => {
        handleFileSelect(path);
        editorRef.current?.focus();
      },
    };
  });
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
      // Monaco's "Go to symbol" list for the open file
      event.preventDefault();
      editorRef.current.focus();
      editorRef.current.trigger("keyboard", "editor.action.quickOutline", null);
    } else if (!event.shiftKey && event.code === "KeyP") {
      event.preventDefault();
      openFinder();
    }
  };

  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

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
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      const selection = editorInstance.getSelection();
      const model = editorInstance.getModel();
      const selectedText =
        selection && model && !selection.isEmpty() && selection.startLineNumber === selection.endLineNumber
          ? model.getValueInRange(selection)
          : "";
      openSearchRef.current(selectedText);
    });

    // In fullscreen, Esc in the editor leaves fullscreen, but only when Monaco does not need Esc
    // itself: no find widget or suggestion list is open, and there is no selection to clear.
    fullscreenContextKeyRef.current = editorInstance.createContextKey("sourceFullscreen", false);
    editorInstance.addCommand(
      monaco.KeyCode.Escape,
      () => setIsFullscreen(false),
      "sourceFullscreen && !findWidgetVisible && !suggestWidgetVisible && !editorHasSelection && !editorHasMultipleSelections"
    );

    // Cmd/Ctrl+P opens Go to file (instead of the browser's Print while the editor has the focus)
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => openFinderRef.current());

    // The outline follows the cursor
    editorInstance.onDidChangeCursorPosition((event) => setCursorLine(event.position.lineNumber));

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
            searchShortcut={isMac ? "⌘⇧F" : "Ctrl+Shift+F"}
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
              finderShortcut={isMac ? "⌘P" : "Ctrl+P"}
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
        </div>
        {finderOpen && (
          <SourceFileFinder
            files={finderFiles}
            shortcut={isMac ? "⌘P" : "Ctrl+P"}
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
