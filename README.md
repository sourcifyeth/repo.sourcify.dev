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

## Read / Write Contract

A contract page has two tabs under the contract header and the three cards: **Code** (the verification data) and **Read/Write Contract** (call the functions of the verified ABI). Each tab has its own URL: `/<chainId>/<address>` and `/<chainId>/<address>/read-write`. Both URLs render the same page, so a tab switch happens in the browser only: the URL changes, the page does not load again, and the back button works. When the Code tab is idle, the page builds the Read/Write tab hidden in the background (its code, the implementation ABI, the RPC list and the clear signing descriptor of the contract), so the first switch does not wait. The hidden tab reads nothing from a chain. A link to a part of the Code tab (`#proxy`, `#file=…`) opens the Code tab. The tab does not show for a contract without functions in its ABI, unless it is a proxy.

The Read/Write tab shows each function as a card that opens with a short animation. From 1024 px wide, the cards are in two columns; each column is its own stack, so an open card pushes down only the cards under it. A closed card shows the name and the kind (read, write, payable). An open card shows the selector (a link to its entry on [4byte.sourcify.dev](https://4byte.sourcify.dev), with a copy button), the form and the result. Functions with a clear signing form are in their own group, "ERC-7730 Clear Signing", above the group "ABI Encoded". Two lines above the list say once that verified code is not audited code and that the user signs in their own wallet. For a proxy, "Read/Write as proxy" shows the functions of the implementation (loaded from the Sourcify API in the browser), and "Read/Write contract" shows the proxy's own functions. Every call goes to the proxy address.

- **Read functions** need no wallet. Each read asks two public RPC endpoints for their newest block, then asks both at the lower of the two blocks and compares the answers: the result says "2 sources agree", or shows both answers if they differ. When the sources agree and the block is not old, the line stays short, and "Details" shows the block, the two hosts, a difference between the two newest blocks, the full URLs and the response times. An old block (more than a minute) is an amber warning that shows at once, as does a failed or single source. Reads send no sender address; only a transparent proxy's own functions are read as its admin (from its storage slot), because such a proxy answers them only to the admin.
- **Data sources:** the endpoints come from [Chainlist](https://chainlist.org/rpcs.json) through the route `/api/chain-rpcs/<chainId>`, which keeps the list in server memory for a day and skips endpoints that do not answer (it checks them with `eth_chainId` and CORS, never on private addresses and without redirects). By default the page takes the first two endpoints from different providers, with "no tracking" ones first. The user can choose others, or enter a custom RPC URL, in "Read data sources"; that choice is kept per chain in the browser. When an endpoint fails, the page swaps it for the next one for this visit only. The calls go from the browser directly to these providers, not through this site. Nothing is sent before the user opens a function or clicks: opening a read function that has no inputs reads it at once ("Expand all" does not).
- **Write functions** need a browser wallet. The page finds installed wallets with EIP-6963 (`window.ethereum` for older wallets) and sends with viem. Right before each send it asks the wallet for its chain and stops on another chain. After a switch it asks the wallet for its chain again, because some wallets send no `chainChanged` event. If the wallet does not know the chain, the page adds it only with Chainlist endpoints that passed the server's check (the read defaults first, at most three), because the wallet keeps these RPCs for the user; if none passed, the user adds the chain in the wallet. After the wallet has sent a transaction, the page waits for the receipt. If none comes in time, it says "Sent, but not confirmed yet", keeps checking, and never offers to send it again. While a transaction is on its way, Reset clears only the form; "Dismiss" hides the note and stops the watch (the transaction itself goes on). There is no simulation before sending and no WalletConnect. "Copy calldata" works without a wallet. The only Connect button is at the top right of the list; until a wallet is connected, the button of a write function says "Connect wallet" and is disabled.
- **Forms:** each input has its name above it and its type as the placeholder. A struct or a list is a bar that opens and closes (closed at first), with "JSON" to fill it from JSON. The native value of a payable function is the field "Send native ETH" (with the chain's currency) on a blue band. Integer inputs have a unit select (wei, gwei, ether and others); with a unit, the field takes a decimal number only (hex works with wei ×1), and the hint shows the sent value in decimal. An empty `bytes` field means `0x`. Address inputs have a paste button, and "Self" (the connected account) when a wallet is connected.
- Results and reverts are decoded with the ABI: `Error(string)`, `Panic(uint256)` and the custom errors of the contract and its implementation.
- NatSpec is hidden at first. An open function that has notes shows a "Show Docs" link. A click shows the notes of that function in small text with badges: "NatSpec Note @notice", "NatSpec Note @dev", "NatSpec Note @param" (under the input) and "NatSpec Note @return" (under a returned value).
- The short terms of use for this feature are at `/write-contract-terms`.

The code is in `src/app/[chainId]/[address]/` (`ContractView.tsx` renders both tabs, `ContractTabs.tsx` switches them, `ContractHeader.tsx` is the part above the tabs), `sections/interact/` (the Read/Write UI, loaded only in the browser with `next/dynamic`, so viem is not in the page's first load) and `src/utils/interact/` (ABI model, two-RPC read, decoding, wallet).

### Clear signing forms (reverse clear signing)

[ERC-7730](https://eips.ethereum.org/EIPS/eip-7730) descriptors tell a wallet how to show a transaction: "Approve 1.5 USDT", not `approve(0x…, 1500000)`. The Read/Write tab uses the same descriptors in the other direction: a function that a descriptor describes gets a form with the descriptor's labels and formats, and the page builds the calldata from what the user types. It uses the builder of [`@ethereum-sourcify/clear-signing`](https://github.com/sourcifyeth/clear-signing) (`getCalldataInputModels`), in the browser, inside the lazy Read/Write code.

- **Where the descriptors come from.** The browser loads the index of the [ERC-7730 registry](https://github.com/ethereum/clear-signing-erc7730-registry) (two files, once per page) and the descriptor of the contract from `raw.githubusercontent.com`. The lookup is by the address of the page; for a proxy that is the proxy address, because a descriptor is bound to the address that users call. No server route is involved. If GitHub does not answer in 8 seconds, or anything else fails, there are no clear signing forms and the page works as before.
- **Tokens without a descriptor.** If the verified ABI (for a proxy: the implementation's ABI) has the six functions of ERC-20 (`totalSupply`, `balanceOf`, `transfer`, `transferFrom`, `approve`, `allowance`) and no `ownerOf`, the page uses the SDK's generic ERC-20 template; with the ERC-721 functions (`ownerOf`, `balanceOf`, `safeTransferFrom`, `setApprovalForAll`, `getApproved`, `isApprovedForAll`), the ERC-721 template. Only the selectors count: names, return types and events are not checked. A descriptor in the registry wins over a template.
- **Each function on its own.** A descriptor covers only some functions. Their cards have a "Clear Signing" badge and open with the clear signing form: the descriptor's intent as "Action: Approve", then the inputs under the title "Fields". All other functions keep the ABI form. An on/off switch "Clear signing" in the open function (on the line of the selector and "Show Docs") changes the form; both forms edit the same values. A descriptor has its own argument names (`_to`), which can differ from the verified ABI (`to`): the page links fields to inputs by position, and only if the descriptor's signature has the types of the verified function.
- **Fields.** The labels are the descriptor's, with the name in the verified ABI next to them. The order is the descriptor's, with one change: inputs that hold a token address come first, because an amount field needs its token's decimals. Inputs that the descriptor does not describe follow with their ABI names. Every input of the function is in the form, also those that a wallet would not show. Controls by format:
  - `tokenAmount`: a decimal amount with the token's symbol. The page reads `decimals()` and `symbol()` of the token with the two-endpoint read (the token is the contract, a fixed address, another input, or the chain's own currency). Until the read answers, or if it fails, the field takes the raw integer. With a `threshold`, a button ("Unlimited", "All") sets the largest value of the type.
  - `amount`: a decimal amount of the chain's currency; for `@.value` it is the native value field with the descriptor's label.
  - `unit`: a decimal number with the unit, for example `0.3 %`.
  - `date`: a date and time in UTC (a block height stays a number). `duration`: a number with seconds, minutes, hours or days. `enum`: a select with the names.
  - Every other format, and a format that does not fit the type: the normal field of the type, with the descriptor's label. Inside a list, each element shows the descriptor's labels; an amount whose token is another value of the same element takes the raw integer.
- **Two encoders.** viem builds the calldata from the verified ABI, as for every ABI form. The SDK's `buildCalldata` builds it again from the descriptor's signature. If the bytes differ, Write is off and a message says so; the ABI form still works.
- **Round trip.** Under the transaction preview, "Your wallet should show" gives the result of the SDK's `format()` for the calldata: the forward direction of the same descriptor. If "1.5" in the form does not come back as "1.5 USDT", the user sees it before they sign. The block does not show if the SDK cannot format the calldata fully.
- **Trust.** A small note under each clear signing form says where the labels come from (the registry, or a generic template) and that they are not attested, with a link to the registry's disclaimer. The page does not check ERC-8176 attestations. A wrong descriptor can give a field a wrong label; the transaction preview, the ABI form and the round trip are there to catch that.

The code is in `src/utils/interact/clearSigning/` (token detection, descriptor signatures and paths, the link to the ABI form, the inverse parsers, the second encoder, the registry loader, token reads; the tests use saved descriptors and no network) and in `sections/interact/` (`useClearSigning.ts`, `DescriptorForm.tsx`, `WalletPreview.tsx`).

## Page sections

The Code tab has a list of its sections: Proxy, ABI, Source Code, Compiler Settings, Metadata.json, the bytecode sections, the storage layouts and the Standard JSON sections. Each label is the heading of its section. From 1280 px wide, the list is a sidebar ("On this page") on the left that stays in view while you scroll. On narrower screens, it is a bar above the sections that sticks to the top. Both mark the section you are in. A click scrolls to the section and does not change the URL hash, because the hash holds the source position. Links with a plain section anchor, such as `#abi` or `#storage-layout`, also work.

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
