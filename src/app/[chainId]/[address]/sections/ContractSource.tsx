"use client";

import { FileNode } from '@/types/codeEditor';
import { ContractData } from "@/types/contract";
import { useState, useEffect, useRef } from "react";
import type { EditorProps } from '@monaco-editor/react';
import MonacoEditor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import CodeEditorTabs from '@/components/CodeEditorTabs';
import FileExplorerTree from '@/components/FileExplorerTree';
import { useCodeEditor } from '@/hooks/useCodeEditor';
import { useIsMobile } from "@/hooks/useResponsive";
import { buildFileTreeWithIds } from '@/utils/fileExplorer';

type Monaco = typeof monaco;

// Define Solidity language configuration
const configureSolidityLanguage = () => {
  return {
    beforeMount: (monaco: Monaco) => {
      // Register Solidity language if it doesn't exist
      if (!monaco.languages.getLanguages().some((lang) => lang.id === "solidity")) {
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
            ],

            comment: [
              [/[^\/*]+/, "comment"],
              [/\/\*/, "comment", "@push"],
              ["\\*/", "comment", "@pop"],
              [/[\/*]/, "comment"],
            ],

            string: [
              [/[^\\"]+/, "string"],
              [/\\./, "string.escape"],
              [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
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

const EDITOR_OPTIONS = (isMobile: boolean): EditorProps['options'] => ({
  readOnly: true,
  minimap: { enabled: isMobile ? false : true },
  scrollBeyondLastLine: false,
  fontSize: isMobile ? 10 : 12,
  wordWrap: "on",
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
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Initialize tabs hook
  const {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    closeAllTabs,
    switchToTab,
  } = useCodeEditor({
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
  }, [contract.sources]);

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
      } else {
        setLanguage("plaintext");
      }
    }
  }, [activeTab]);

  // Handle editor mounting
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Configure Solidity language
  const solidityConfig = configureSolidityLanguage();

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <div className="flex flex-col md:flex-row">
          {/* File Explorer */}
          <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-gray-700">
            <FileExplorerTree
              files={fileTreeWithIds}
              activeFile={activeTab?.path}
              onFileSelect={handleFileSelect}
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
            {/* Monaco Editor */}
            <div className="flex-1 relative">
              {activeTab ? (
                <MonacoEditor
                  className="editor-container"
                  height="100%"
                  language={language}
                  path={activeTab.path}
                  defaultValue={activeTab.content}
                  options={EDITOR_OPTIONS(isMobile)}
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
