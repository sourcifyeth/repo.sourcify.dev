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

The code that reads and writes these links is in `src/utils/sourceHash.ts`. The keys `R` (a byte range) and `sym` (a function signature) are reserved for later features. The page reads them, but does not use them yet.

## Searching the source code

The Source Code section can search all source files of a contract at the same time, including library files such as OpenZeppelin.

### Opening the search

- Click the search icon at the top of the left panel. The folder icon goes back to the file tree.
- Or press **Cmd+Shift+F** (macOS) or **Ctrl+Shift+F** (Windows, Linux) while the focus is in the Source Code section. If text on one line is selected in the editor, the search starts with that text.
- **Ctrl+F** or **Cmd+F** in the editor still searches only the open file.

### Search options

The search runs while you type. Three buttons in the search box change how it matches:

| Button | Shortcut | Effect |
| ------ | -------- | ------ |
| **Aa** Match Case | Alt+C | Matches upper and lower case exactly. Without it, `owner` also finds `Owner`. |
| **ab** Match Whole Word | Alt+W | Matches only full names. Letters, digits, `_` and `$` count as parts of a name, so `owner` does not find `_owner` or `setOwner`. |
| **.\*** Use Regular Expression | Alt+R | Reads the query as a JavaScript regular expression. `^` and `$` match at the start and end of each line. |

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

### Size and fullscreen

On a desktop screen, the source view is about 75% of the window height (at least 540 px). The fullscreen button in the editor toolbar makes the source view fill the window. To leave fullscreen, click the button again or press **Esc**. In the editor, Esc first closes the find box or clears a selection, and the next Esc leaves fullscreen.

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
