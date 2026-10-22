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
import { useCodeEditor } from "@/hooks/useCodeEditor";
import { useIsMobile } from "@/hooks/useResponsive";
import { useSourceHash } from "@/hooks/useSourceHash";
import { buildFileTreeWithIds } from "@/utils/fileExplorer";
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

// Define Solidity language configuration
const configureSolidityLanguage = () => {
  return {
    beforeMount: (monaco: Monaco) => {
      // Register Solidity language if it doesn't exist
      if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === "solidity")) {
        // Register the Solidity language
        monaco.languages.register({ id: "solidity" });

        // Define Solidity tokens and syntax highlighting rules
        monaco.languages.setMonarchTokensProvider("solidity", {
          defaultToken: "invalid",
          tokenPostfix: ".sol",

          keywords: [
            "pragma",
            "solidity",
            "contract",
            "library",
            "interface",
            "function",
            "modifier",
            "event",
            "struct",
            "enum",
            "mapping",
            "public",
            "private",
            "internal",
            "external",
            "pure",
            "view",
            "payable",
            "constant",
            "immutable",
            "virtual",
            "override",
            "returns",
            "memory",
            "storage",
            "calldata",
            "if",
            "else",
            "for",
            "while",
            "do",
            "break",
            "continue",
            "return",
            "throw",
            "emit",
            "try",
            "catch",
            "revert",
            "require",
            "assert",
            "using",
            "new",
            "delete",
            "constructor",
            "fallback",
            "receive",
            "abstract",
            "is",
            "indexed",
            "import",
            "from",
            "as",
            "type",
            "assembly",
          ],

          typeKeywords: [
            "address",
            "bool",
            "string",
            "uint",
            "uint8",
            "uint16",
            "uint32",
            "uint64",
            "uint128",
            "uint256",
            "int",
            "int8",
            "int16",
            "int32",
            "int64",
            "int128",
            "int256",
            "bytes",
            "bytes1",
            "bytes2",
            "bytes3",
            "bytes4",
            "bytes5",
            "bytes6",
            "bytes7",
            "bytes8",
            "bytes9",
            "bytes10",
            "bytes11",
            "bytes12",
            "bytes13",
            "bytes14",
            "bytes15",
            "bytes16",
            "bytes17",
            "bytes18",
            "bytes19",
            "bytes20",
            "bytes21",
            "bytes22",
            "bytes23",
            "bytes24",
            "bytes25",
            "bytes26",
            "bytes27",
            "bytes28",
            "bytes29",
            "bytes30",
            "bytes31",
            "bytes32",
            "fixed",
            "ufixed",
            "var",
          ],

          operators: [
            "=",
            ">",
            "<",
            "!",
            "~",
            "?",
            ":",
            "==",
            "<=",
            ">=",
            "!=",
            "&&",
            "||",
            "++",
            "--",
            "+",
            "-",
            "*",
            "/",
            "&",
            "|",
            "^",
            "%",
            "<<",
            ">>",
            ">>>",
            "+=",
            "-=",
            "*=",
            "/=",
            "&=",
            "|=",
            "^=",
            "%=",
            "<<=",
            ">>=",
            ">>>=",
          ],

          symbols: /[=><!~?:&|+\-*\/\^%]+/,

          tokenizer: {
            root: [
              // Identifiers and keywords
              [
                /[a-zA-Z_$][\w$]*/,
                {
                  cases: {
                    "@keywords": "keyword",
                    "@typeKeywords": "type",
                    "@default": "identifier",
                  },
                },
              ],

              // Whitespace
              { include: "@whitespace" },

              // Delimiters and operators
              [/[{}()\[\]]/, "@brackets"],
              [/[<>](?!@symbols)/, "@brackets"],
              [
                /@symbols/,
                {
                  cases: {
                    "@operators": "operator",
                    "@default": "",
                  },
                },
              ],

              // Numbers
              [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
              [/0[xX][0-9a-fA-F]+/, "number.hex"],
              [/\d+/, "number"],

              // Delimiter
              [/[;,.]/, "delimiter"],

              // Strings
              [/"([^"\\]|\\.)*$/, "string.invalid"],
              [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
              [/'([^'\\]|\\.)*$/, "string.invalid"],
              [/'/, { token: "string.quote", bracket: "@open", next: "@stringSingle" }],
            ],

            // Solidity block comments do not nest: the first "*/" always ends the comment,
            // even if a "/*" appears inside it (e.g. "/*////" ... "////*/" banners).
            comment: [
              [/[^*]+/, "comment"],
              [/\*\//, "comment", "@pop"],
              [/\*/, "comment"],
            ],

            string: [
              [/[^\\"]+/, "string"],
              [/\\./, "string.escape"],
              [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
            ],

            stringSingle: [
              [/[^\\']+/, "string"],
              [/\\./, "string.escape"],
              [/'/, { token: "string.quote", bracket: "@close", next: "@pop" }],
            ],

            whitespace: [
              [/[ \t\r\n]+/, "white"],
              [/\/\*/, "comment", "@comment"],
              [/\/\/.*$/, "comment"],
            ],
          },
        });

        // Define language configuration for editor features
        monaco.languages.setLanguageConfiguration("solidity", {
          comments: {
            lineComment: "//",
            blockComment: ["/*", "*/"],
          },
          brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
          ],
          autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
          ],
          surroundingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
          ],
          folding: {
            markers: {
              start: new RegExp("^\\s*//\\s*#?region\\b"),
              end: new RegExp("^\\s*//\\s*#?endregion\\b"),
            },
          },
        });
      }
    },
  };
};

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

  // Build file tree from contract sources
  useEffect(() => {
    const treeWithIds = buildFileTreeWithIds(contract.sources, contract.compilation.fullyQualifiedName);
    setFileTreeWithIds(treeWithIds);
  }, [contract.sources, contract.compilation.fullyQualifiedName]);

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
    if (activeTab) {
      const extension = activeTab.path.split(".").pop()?.toLowerCase();
      if (extension === "sol") {
        setLanguage("solidity");
      } else if (extension === "vy") {
        setLanguage("elixir");
      } else if (extension === "fe") {
        setLanguage("rust");
      } else {
        setLanguage("plaintext");
      }
    }
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

  // A click on a result opens the file and selects the match
  const [revealRequest, setRevealRequest] = useState<{ path: string; match: SearchMatch; id: number } | null>(null);
  const handledRevealRef = useRef(0);
  const openSearchMatch = (path: string, match: SearchMatch) => {
    const source = contract.sources[path];
    if (!source) return;
    setActiveMatch({ path, match });
    openTab(path, source.content);
    setRevealRequest((previous) => ({ path, match, id: (previous?.id ?? 0) + 1 }));
  };

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorReady || !editorInstance || !monaco || !activeTab || !revealRequest) return;
    if (revealRequest.id === handledRevealRef.current || revealRequest.path !== activeTab.path) return;
    handledRevealRef.current = revealRequest.id;
    const { match } = revealRequest;
    const range = new monaco.Range(match.startLine, match.startColumn, match.endLine, match.endColumn);
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

  // Cmd/Ctrl+Shift+F while the focus is in the source section but outside the
  // editor (the editor has its own command, registered on mount)
  const onSourceKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.code !== "KeyF") return;
    if (editorRef.current?.hasTextFocus()) return;
    event.preventDefault();
    openSearch();
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

    setEditorReady(true);
  };

  // Configure Solidity language
  const solidityConfig = configureSolidityLanguage();

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg" onKeyDown={onSourceKeyDown}>
      <div className="border-t border-gray-200">
        <div className="flex flex-col md:flex-row">
          {/* File Explorer */}
          <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-gray-700">
            <SourceSidebar
              view={sidebarView}
              onViewChange={changeSidebarView}
              searchShortcut={isMac ? "⌘⇧F" : "Ctrl+Shift+F"}
              explorer={
                <FileExplorerTree files={fileTreeWithIds} activeFile={activeTab?.path} onFileSelect={handleFileSelect} />
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
          <div className="w-full md:w-3/4 flex flex-col">
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
              />
            )}
            {/* Monaco Editor */}
            <div className="source-editor md:flex-1 relative h-[500px] md:h-auto">
              {activeTab ? (
                <MonacoEditor
                  className="editor-container"
                  height="100%"
                  language={language}
                  path={activeTab.path}
                  defaultValue={activeTab.content}
                  options={editorOptions}
                  beforeMount={solidityConfig.beforeMount}
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
        </div>
      </div>
    </div>
  );
}
