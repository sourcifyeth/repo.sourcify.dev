import type { Monaco } from "@monaco-editor/react";

/**
 * Syntax highlighting for the source view: Solidity and Vyper grammars in
 * Monarch, Monaco's regex-based highlighting format. Call it in the editor's
 * `beforeMount`; it registers each language once.
 *
 * NatSpec tags (`@notice`, `@param`, …) in comments and Vyper docstrings get
 * the token `keyword.natspec`, so the theme shows them in the keyword color.
 */

const sizes = (prefix: string, from: number, to: number, step: number) =>
  Array.from({ length: (to - from) / step + 1 }, (_, i) => `${prefix}${from + i * step}`);

const SOLIDITY_KEYWORDS = [
  "pragma", "solidity", "contract", "library", "interface", "abstract", "is", "function", "modifier", "event",
  "error", "struct", "enum", "type", "mapping", "public", "private", "internal", "external", "pure", "view",
  "payable", "constant", "immutable", "transient", "virtual", "override", "returns", "memory", "storage",
  "calldata", "if", "else", "for", "while", "do", "break", "continue", "return", "throw", "emit", "try", "catch",
  "revert", "require", "assert", "using", "new", "delete", "constructor", "fallback", "receive", "indexed",
  "anonymous", "import", "from", "as", "assembly", "unchecked", "let", "switch", "case", "default", "leave",
  "this", "super", "true", "false", "global", "layout", "at",
];

const SOLIDITY_TYPES = [
  "address", "bool", "string", "bytes", "byte", "fixed", "ufixed", "var", "uint", "int",
  ...sizes("uint", 8, 256, 8),
  ...sizes("int", 8, 256, 8),
  ...sizes("bytes", 1, 32, 1),
];

const NATSPEC_TAG = /@[a-zA-Z][\w:-]*/;

function registerSolidity(monaco: Monaco) {
  monaco.languages.register({ id: "solidity", extensions: [".sol"] });
  monaco.languages.setMonarchTokensProvider("solidity", {
    defaultToken: "invalid",
    tokenPostfix: ".sol",
    keywords: SOLIDITY_KEYWORDS,
    typeKeywords: SOLIDITY_TYPES,
    operators: [
      "=", ">", "<", "!", "~", "?", ":", "==", "<=", ">=", "!=", "&&", "||", "++", "--", "+", "-", "*", "/", "&",
      "|", "^", "%", "<<", ">>", ">>>", "+=", "-=", "*=", "/=", "&=", "|=", "^=", "%=", "<<=", ">>=", ">>>=", "=>",
      "**", ":=",
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    tokenizer: {
      root: [
        // hex"…" and unicode"…" string literals
        [/\b(hex|unicode)(?=["'])/, "keyword"],

        // Identifiers and keywords
        [/[a-zA-Z_$][\w$]*/, { cases: { "@keywords": "keyword", "@typeKeywords": "type", "@default": "identifier" } }],

        { include: "@whitespace" },

        [/[{}()[\]]/, "@brackets"],
        [/[<>](?!@symbols)/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],

        // Numbers
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/0[xX][0-9a-fA-F_]+/, "number.hex"],
        [/\d[\d_]*([eE][-+]?\d+)?/, "number"],

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
        [/[^*@]+/, "comment"],
        [NATSPEC_TAG, "keyword.natspec"],
        [/@/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/\*/, "comment"],
      ],

      // A line comment that holds an "@". Every rule that reaches the end of
      // the line pops the state, so the next line is code again.
      lineComment: [
        [/@[a-zA-Z][\w:-]*$/, "keyword.natspec", "@pop"],
        [NATSPEC_TAG, "keyword.natspec"],
        [/[^@]+$/, "comment", "@pop"],
        [/[^@]+/, "comment"],
        [/@$/, "comment", "@pop"],
        [/@/, "comment"],
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
        [/\/\/(?=.*@)/, "comment", "@lineComment"],
        [/\/\/.*$/, "comment"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration("solidity", {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
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

const VYPER_KEYWORDS = [
  "def", "return", "if", "elif", "else", "for", "in", "range", "pass", "break", "continue", "assert", "raise", "log",
  "event", "struct", "interface", "implements", "import", "from", "as", "enum", "flag", "public", "constant",
  "immutable", "transient", "indexed", "empty", "self", "and", "or", "not", "True", "False", "None", "uses",
  "initializes", "exports", "extcall", "staticcall", "UNREACHABLE", "msg", "block", "tx", "chain",
];

const VYPER_TYPES = [
  "address", "bool", "decimal", "Bytes", "String", "DynArray", "HashMap", "bytes", "uint", "int",
  ...sizes("uint", 8, 256, 8),
  ...sizes("int", 8, 256, 8),
  ...sizes("bytes", 1, 32, 1),
];

function registerVyper(monaco: Monaco) {
  monaco.languages.register({ id: "vyper", extensions: [".vy", ".vyi"] });
  monaco.languages.setMonarchTokensProvider("vyper", {
    defaultToken: "",
    tokenPostfix: ".vy",
    keywords: VYPER_KEYWORDS,
    typeKeywords: VYPER_TYPES,
    tokenizer: {
      root: [
        // Decorators: @external, @view, @nonreentrant("lock"), …
        [/@[a-zA-Z_]\w*/, "tag"],
        [/#.*$/, "comment"],
        [/"""/, "string", "@docstringDouble"],
        [/'''/, "string", "@docstringSingle"],
        [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@typeKeywords": "type", "@default": "identifier" } }],
        [/[ \t\r\n]+/, "white"],
        [/[{}()[\]]/, "@brackets"],
        [/0[xX][0-9a-fA-F_]+/, "number.hex"],
        [/\d*\.\d+([eE][-+]?\d+)?/, "number.float"],
        [/\d[\d_]*([eE][-+]?\d+)?/, "number"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/->|[-+*/%=<>!&|^~:]+/, "operator"],
        [/[;,.]/, "delimiter"],
      ],
      docstringDouble: [
        [/[^"@]+/, "string"],
        [NATSPEC_TAG, "keyword.natspec"],
        [/"""/, "string", "@pop"],
        [/["@]/, "string"],
      ],
      docstringSingle: [
        [/[^'@]+/, "string"],
        [NATSPEC_TAG, "keyword.natspec"],
        [/'''/, "string", "@pop"],
        [/['@]/, "string"],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration("vyper", {
    comments: { lineComment: "#" },
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
    // Vyper blocks follow indentation, like Python
    folding: { offSide: true },
  });
}

export function registerSourceLanguages(monaco: Monaco) {
  const known = new Set(monaco.languages.getLanguages().map((language: { id: string }) => language.id));
  if (!known.has("solidity")) registerSolidity(monaco);
  if (!known.has("vyper")) registerVyper(monaco);
}

/** The Monaco language for a source path. */
export function monacoLanguageOfPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "sol") return "solidity";
  if (extension === "vy" || extension === "vyi") return "vyper";
  if (extension === "fe") return "rust";
  return "plaintext";
}
