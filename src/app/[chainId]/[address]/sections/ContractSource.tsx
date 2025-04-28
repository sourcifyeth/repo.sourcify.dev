"use client";

import { ContractData } from "@/types/contract";
import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import CopyToClipboardButton from "@/components/CopyToClipboardButton";

// Define Monaco editor types
type Monaco = typeof import("monaco-editor");

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

interface ContractSourceProps {
  contract: ContractData;
}

export default function ContractSource({ contract }: ContractSourceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(Object.keys(contract.sources)[0] || null);
  const [language, setLanguage] = useState<string>("solidity");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const fileNames = Object.keys(contract.sources);

  // Determine language based on file extension
  useEffect(() => {
    if (activeFile) {
      const extension = activeFile.split(".").pop()?.toLowerCase();
      if (extension === "sol") {
        setLanguage("solidity");
      } else if (extension === "vy") {
        setLanguage("elixir");
      } else {
        setLanguage("plaintext");
      }
    }
  }, [activeFile]);

  // Handle editor mounting
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Configure Solidity language
  const solidityConfig = configureSolidityLanguage();

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <div className="flex flex-col md:flex-row">
          {/* File selector */}
          <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-gray-200">
            <ul className="divide-y divide-gray-200 max-h-60 md:max-h-[500px] overflow-y-auto">
              {fileNames.map((fileName) => (
                <li
                  key={fileName}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm  ${
                    activeFile === fileName ? "bg-gray-100 border-l-4 border-gray-500 font-medium" : ""
                  }`}
                  onClick={() => setActiveFile(fileName)}
                  title={fileName}
                >
                  {fileName}
                </li>
              ))}
            </ul>
          </div>

          {/* Source code display with Monaco editor */}
          <div className="w-full md:w-3/4">
            {activeFile ? (
              <div className="h-[500px] relative">
                <div className="absolute top-2 right-4 z-10">
                  <CopyToClipboardButton data={contract.sources[activeFile].content} variant="icon-only" />
                </div>
                <Editor
                  height="100%"
                  language={language}
                  value={contract.sources[activeFile].content}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
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
                    },
                    lineNumbers: "on",
                    glyphMargin: true,
                    folding: true,
                    renderLineHighlight: "all",
                  }}
                  beforeMount={solidityConfig.beforeMount}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-500">No source files available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
