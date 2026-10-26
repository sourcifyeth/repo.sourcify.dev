# Sourcify Contract Viewer

A Next.js application for viewing verified smart contract details from the Sourcify API.

## Linking to source code

A contract page can link to a source file and to lines in that file. The link puts the position in the URL hash, after the `#`:

```
https://repo.sourcify.dev/<chainId>/<address>#file=<path>&L=<start>-<end>
```

For example, this link opens `ECDSA.sol` in the SeaDrop contract and highlights lines 60 to 72:

```
https://repo.sourcify.dev/1/0x00005EA00Ac477B1030CE78506496e8C2dE24bf5#file=lib/openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol&L=60-72
```

### Parameters

| Key    | Value                                                         | Example                    |
| ------ | ------------------------------------------------------------- | -------------------------- |
| `file` | The source path, as it appears in the contract's source files | `file=src/SeaDrop.sol`     |
| `L`    | One line, or a range of lines. Line numbers start at 1.       | `L=40` or `L=60-72`        |
| `sym`  | A declaration in the file: `Contract.member`, or a name       | `sym=SeaDrop._publicDrops` |
| `R`    | A byte range in the file (UTF-8 offsets, from a source map)   | `R=6520-6548`              |

- `file` is necessary. Without `L`, the link opens the file and selects no lines.
- If the range is in the wrong order (`L=72-60`), the page sorts it.
- If the range goes past the end of the file, the page stops the highlight at the last line.
- If no source file has that path, the page ignores the link and shows the main contract file.

### Encoding the path

Encode the path with `encodeURIComponent`. The page also accepts `/`, `@` and `:` without encoding, and writes them that way to keep links readable. You must encode `&`, `#`, `=`, `%`, `+` and spaces.

```js
const hash = `#file=${encodeURIComponent(path)}&L=${start}-${end}`;
```

### What the page does with a link

1. It opens the file in a tab.
2. It highlights the lines and scrolls them to the middle of the editor.
3. It scrolls the page to the Source Code section.

A hash change on an open page (for example a click on a `#file=…` link elsewhere on the page) does the same, without a reload. The browser does not send the hash to the server, so a link to lines costs no extra server work.

### Selecting lines in the page

- Click a line number to select that line. Shift+click a second line number to select a range.
- The address bar updates while you select. **Copy link** in the editor toolbar copies the link.
- You can also select code, right-click it, and choose **Copy Link to Selected Lines**.
- The **?** button in the editor toolbar shows the same help.

The code that reads and writes these links is in `src/utils/sourceHash.ts`. The key `sym` names a declaration, as `Contract.member` or `name`; the Storage Layout links use it (see "Storage layout links" below). The key `R` is a byte range from the bytecode's source map (see "Bytecode and source" below).

## Searching the source code

The Source Code section can search all source files of a contract at the same time, including library files such as OpenZeppelin.

### Opening the search

- Click the search icon at the top of the left panel. The folder icon goes back to the file tree.
- Or press **Cmd+Shift+F** (macOS) or **Ctrl+Shift+F** (Windows, Linux) while the focus is in the Source Code section. If text on one line is selected in the editor, the search starts with that text.
- **Ctrl+F** or **Cmd+F** in the editor still searches only the open file.

### Search options

The search runs while you type. Three buttons in the search box change how it matches:

| Button                         | Shortcut | Effect                                                                                                                           |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Aa** Match Case              | Alt+C    | Matches upper and lower case exactly. Without it, `owner` also finds `Owner`.                                                    |
| **ab** Match Whole Word        | Alt+W    | Matches only full names. Letters, digits, `_` and `$` count as parts of a name, so `owner` does not find `_owner` or `setOwner`. |
| **.\*** Use Regular Expression | Alt+R    | Reads the query as a JavaScript regular expression. `^` and `$` match at the start and end of each line.                         |

If the regular expression is not valid, the panel shows the error and no results.

### Results

- The results are grouped by file. The main contract file comes first, then the other files in path order.
- The panel shows the number of results and files. A screen reader announces this number.
- Click a result to open the file. The editor selects the match and highlights all other matches in the file, also in the minimap and in the scrollbar.
- With the keyboard: **Enter** in the search box opens the first result. **Down arrow** moves into the results, and the arrow keys move between them. **Esc** goes back to the search box, and a second **Esc** goes to the editor.
- The search stops at 2,000 results. Then the count shows `2,000+` and asks you to narrow the search.

The search code is in `src/utils/sourceSearch.ts`. It runs in the browser on the source files that the page already has, so it sends no requests to the server.

## Browsing the source files

### File tree

- The box above the tree filters the tree by path. Type a part of a path (any case), and the tree shows only the files whose path contains it. **Esc** or the **×** button clears the filter.
- The main contract file has a star.
- Library files are dimmed and have a **LIB** tag. A folder that holds only library files is dimmed too. A file counts as library code if its path is in `node_modules/`, starts with `lib/`, has a folder that starts with `@` (an npm scope such as `@openzeppelin/`), has a folder with the name of a well-known library (OpenZeppelin, solmate, solady, forge-std, ds-test), or starts with the prefix of a remapping that points into library code. The rules are in `src/utils/libraryFiles.ts`. They are a best guess from the path.
- **Other files**: some contracts were verified with more files than they use. These files were in the compiler input, but the contract's metadata does not list them, so they have no effect on the bytecode. They show in a separate "Other files" group at the end of the tree. The group starts closed. If a link or a search result opens one of these files, the tree opens the group to show it.

### Go to file

Press **Cmd+P** (macOS) or **Ctrl+P** (Windows, Linux) while the focus is in the Source Code section, or click **Go to file** in the editor toolbar. Then type a part of a file name. The match is fuzzy, and a match in the file name counts more than a match in the folders. Use the arrow keys and **Enter** to open a file, or **Esc** to close the box. Without a query, the list shows the project's own files first, then library files, then other files. Outside the Source Code section, Cmd/Ctrl+P is still the browser's Print.

### Outline and symbols

- The Explorer tab has two sections: **Files** (the tree) and **Outline**. Click a section title to close or open it. On small screens the outline starts closed.
- The outline lists the symbols of the open file: contracts, interfaces and libraries, with their functions, modifiers, events, errors, structs, enums and state variables. Each row has an icon for its kind: VS Code's symbol icons (codicons), except an "fn" glyph for functions. Hover an icon to see the kind. Each row shows the parameter types, and badges for visibility (`ext`, `pub`, `int`, `priv`) and mutability (`view`, `pure`, `payable`, `constant`, `immutable`). Click a row to go to the declaration.
- The outline follows the cursor: it marks the symbol that holds the cursor and keeps it in view.
- **Cmd+Shift+O** (macOS) or **Ctrl+Shift+O** lists the symbols of the open file. Type to filter, and press Enter to go to a symbol.
- In Go to file (**Cmd/Ctrl+P**), type **@** first to find a symbol in the open file, or **#** first to find a symbol in all files (for example `#transfer`). With `#`, the files are read in the background, the project's own files first. The box shows the progress, and results show while it runs. For Uniswap V3 Factory (390 files), this takes a few seconds.
- How the symbols are found: Solidity files are read by [@solidity-parser/parser](https://github.com/solidity-parser/parser) in a Web Worker (a background thread), only when needed. If the parser cannot read a file (very old or very new syntax), a simple scan is used, and the outline says so. Vyper files always use a simple scan of the top-level declarations. The code is in `src/utils/sourceSymbols.ts` and `src/workers/sourceSymbols.worker.ts`. These symbols come from the syntax only. They do not resolve names, so "go to definition" is not in this feature.

### Selectors, hover docs and go to definition

- **Selectors (CodeLens):** a small gray line above each external or public function, each public state variable (its getter), each error and each event shows its 4-byte selector, or its 32-byte topic for events. A copy icon starts the line; a click copies the value, and the line shows "copied" for a moment. The values for the main contract and the contracts it inherits from come from the compiler's signatures (the `signatures` field of the Sourcify API). Other values are computed here with keccak256 of the canonical signature, but only when every parameter type is known without full type resolution: built-in types, contracts and interfaces (`address`) and enums (`uint8`). Declarations with struct parameters outside the inheritance chain, internal and private functions, library functions and anonymous events get no line.
- **Hover:** hovering a name shows its declaration, its selector or topic, and its NatSpec under a "NatSpec" heading that says where it comes from. For the main contract, NatSpec comes from the compiler's `userdoc` and `devdoc`. For other code, it comes from the doc comment above the declaration (Solidity) or the docstring (Vyper), and one `@inheritdoc` is followed.
- **Go to definition (best guess):** **Cmd/Ctrl+click** a name to jump to its declaration, also in another file. The match is by name only: the source view does not resolve scopes, so a local variable with the same name as a state variable can go to the wrong place. If several declarations have the name, a list shows all of them: implementations before interface declarations, then the main contract and its bases, then the same file. The hover says "Best guess by name" in that case.
- **Find references:** **Shift+F12** (or "Go to References" in the right-click menu) lists every place where the name occurs as a whole word, case-sensitive, in the compiled files. It is a text search, not a semantic one.
- The code is in `src/utils/sourceIntelligence.ts`, `src/utils/selectors.ts`, `src/utils/natspec.ts` and `src/utils/monacoProviders.ts`.

### Storage layout links

In the Storage Layout table, a file icon (a page with `</>` on it) next to each variable name links to its declaration, as `#file=<file>&sym=<Contract>.<variable>`. Its tooltip says "Show the declaration in the source code". The source view opens the file, highlights the declaration and adds its lines to the URL. Solidity's storage layout names the compiled contract even for variables that a base contract declares (for example `locked` from solmate's `ReentrancyGuard`). If the variable is not in the named contract, the source view looks for it in the base contracts, nearest first.

### Bytecode and source

The compiler's source map ties each bytecode instruction to a range of source code. The page uses it in both directions, for the creation and the runtime bytecode.

- **Opcodes view:** in the Creation Bytecode and Runtime Bytecode sections, choose **Opcodes**. The list has one row per instruction: the byte offset, the opcode and its pushed value, a jump arrow (→ into a function, ← out of a function), and the source file and line with a snippet of the code. Click a row to open the Source Code section with that exact range highlighted. Rows can also say "compiler-generated" (code without a source, such as Yul helper functions) or "no source map entry" (after the end of the map: the metadata, or in the creation bytecode the runtime code that the constructor deploys). The instructions come from the on-chain bytecode; if it is missing, from the recompiled bytecode, with library placeholders as zero bytes.
- **Show in Bytecode:** in the editor, select lines (or put the cursor on a line), right-click, and choose **Show in Bytecode**. The bytecode sections switch to Opcodes and highlight the instructions whose source range lies inside those lines, with a count. Ranges that cover more (a whole function or contract) are left out. The page scrolls to the runtime section, or to the creation section for constructor code. If no instruction comes only from those lines, the status bar says so.
- **Range links:** a click on an instruction writes `#file=<path>&R=<start>-<end>` to the URL. `R` is a byte range from the source map (UTF-8 offsets); the source view converts it to editor positions. These links can be shared.
- The code is in `src/utils/sourceMap.ts` (source map decoder, disassembler, UTF-8 offsets), `src/components/BytecodeOpcodes.tsx`, and `src/utils/sourceRegistry.ts` (the source view shares the source files with the bytecode sections in the browser, so the page does not send them twice).

### Import links

In a Solidity file, the path of each `import` is a link. **Cmd+click** (macOS) or **Ctrl+click** opens the imported file in a tab. The path resolves like the compiler does: relative paths from the importing file, then the remappings of the compilation, then the path itself. If none of these is a source file, a file whose path ends with the import path is used, but only if exactly one file matches. Imports that do not resolve have no link. The code is in `src/utils/importResolution.ts`.

### Syntax colors

- Solidity: the keywords include `error`, `unchecked`, `transient`, `receive`, `fallback` and Yul keywords (`let`, `switch`, `leave`), all integer and `bytesN` types, and `hex"…"` and `unicode"…"` strings. NatSpec tags (`@notice`, `@param`, `@custom:…`) in comments show in the keyword color.
- Vyper: Vyper files have their own grammar (decorators, `def`, `event`, `struct`, `interface`, types, `#` comments, docstrings with NatSpec tags). Before, they used Elixir colors.
- The grammars are in `src/utils/monacoLanguages.ts`.

### Shortcut hints

- A status bar under the code shows the cursor position and the language on the left, and the main shortcuts on the right: Go to file, Search in all files, Go to symbol, and "? all shortcuts". Each hint is also a button. On small screens, only the position shows.
- The **?** button in the editor toolbar (or "? all shortcuts" in the status bar) opens a sheet with all shortcuts and the link help.
- The editor's right-click menu starts with **Go to File…**, **Search in All Files** and **Go to Symbol…**, each with its shortcut.
- On macOS the labels use the standard symbols (⇧⌘F); on other platforms they are spelled out (Ctrl+Shift+F). The labels come from `src/utils/shortcuts.ts`.

### Size and fullscreen

On a desktop screen, the source view is about 75% of the window height (at least 540 px). The fullscreen button in the editor toolbar makes the source view fill the window. To leave fullscreen, click the button again or press **Esc**. In the editor, Esc first closes the find box or clears a selection, and the next Esc leaves fullscreen.

## Page sections

A bar under the contract header links to each section of the page (Details, ABI, Source Code, Compiler, Metadata, the bytecode sections, Storage, and the Standard JSON sections). It sticks to the top while you scroll and marks the section you are in. A click scrolls to the section and does not change the URL hash, because the hash holds the source position. Links with a plain section anchor, such as `#abi` or `#storage-layout`, also work.

The page does not include the large JSON values. The Metadata, Standard JSON Input and Standard JSON Output sections load their value from the Sourcify API when you scroll near them. If the request fails, the section shows a **Retry** button. Each JSON viewer starts its editor only when it comes near the screen.

## Monaco editor files

The app serves the Monaco editor itself, in the version that `package.json` installs. `scripts/copy-monaco.mjs` copies `node_modules/monaco-editor/min/vs` to `public/monaco/<version>/vs`. It runs before `npm run dev` and `npm run build`. The folder is in `.gitignore`. `src/utils/monacoLoader.ts` points the editor loader at this folder, so the browser does not load Monaco from a CDN.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- Docker (optional, for containerized deployment)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
SOURCIFY_SERVER_URL=https://sourcify.dev/server
SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server
# NODE_ENV=development or NODE_ENV=production
```

- `SOURCIFY_SERVER_URL`: the public URL of the Sourcify server. The browser uses it (similarity verification) and so do redirects, so it must be reachable from the internet.
- `SOURCIFY_SERVER_INTERNAL_URL`: the URL the Next.js server uses for its own calls to the Sourcify server (contract pages are rendered server-side). Locally this is just the public URL again. In production it must be the Sourcify server's direct service URL (its Cloud Run `*.run.app` URL, without the `/server` path prefix) so the traffic stays inside the network instead of leaving and re-entering through the public load balancer, where a per-IP rate limit would put every visitor's page view in one shared bucket. Both are required and checked in `next.config.ts`, so `next build` and `next dev` fail immediately when one is missing. Pass both at build time (the growthepie top-contracts route is pre-rendered during `next build`) and at runtime, in every environment that builds the app: Cloud Build, Netlify deploy previews, local `.env`.

### Running Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/sourcifyeth/repo.sourcify.dev.git
   cd repo.sourcify.dev
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Run the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

5. Run the unit tests (Vitest):

   ```bash
   npm test
   ```

6. Format the code with Prettier, and check the format and lint rules (CI runs these on every pull request):

   ```bash
   npm run format
   npm run format:check
   npm run lint
   ```

### Building for Production

```bash
npm run build
npm start
# or
yarn build
yarn start
```

## Docker Deployment

The project includes a Dockerfile based on the official Next.js Docker example.

### Building and Running with Docker

Keep in mind you need to pass the `SOURCIFY_SERVER_URL` as a build argument. The way to pass this might differ depending on your build platform. In Google Cloud Build, you need to pass it as a value to be substituted in your `cloudbuild.yaml` file:

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - "--build-arg"
      - "SOURCIFY_SERVER_URL=${_SOURCIFY_SERVER_URL}"
      - "--build-arg"
      - "SOURCIFY_SERVER_INTERNAL_URL=${_SOURCIFY_SERVER_INTERNAL_URL}"
---
substitutions:
  _SOURCIFY_SERVER_URL: https://sourcify.dev/server
  _SOURCIFY_SERVER_INTERNAL_URL: https://<sourcify-server-service>.a.run.app
```

1. Build the Docker image:

   ```bash
   # Build the image with the Sourcify server URL as a build argument
   docker build --build-arg SOURCIFY_SERVER_URL=https://sourcify.dev/server --build-arg SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server -t repo-sourcify .
   ```

2. Run the container:

   ```bash
   docker run -p 3000:3000 -e SOURCIFY_SERVER_URL=https://sourcify.dev/server -e SOURCIFY_SERVER_INTERNAL_URL=https://sourcify.dev/server repo-sourcify
   ```

3. Access the application at [http://localhost:3000](http://localhost:3000).
