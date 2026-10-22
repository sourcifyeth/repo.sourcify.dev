"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Fuse, { FuseResultMatch } from "fuse.js";
import SymbolIcon from "./SymbolIcon";
import { FileSymbols, flattenSymbols, SourceSymbol } from "@/utils/sourceSymbols";

export interface FinderFile {
  path: string;
  isLibrary: boolean;
  // False for files that the compiled contract does not use ("Other files")
  isCompiled: boolean;
}

interface SourceFileFinderProps {
  files: FinderFile[];
  shortcut: string;
  onOpen: (path: string) => void;
  onClose: () => void;
  // Symbols, for the "@" (open file) and "#" (all files) prefixes
  activePath: string | undefined;
  getSymbols: (path: string) => FileSymbols | undefined;
  // Changes when new symbols arrive
  symbolsVersion: number;
  onRequestSymbols: (paths: string[]) => void;
  onOpenSymbol: (path: string, symbol: SourceSymbol) => void;
}

const MAX_RESULTS = 50;

type Mode = "files" | "fileSymbols" | "allSymbols";

interface FinderEntry extends FinderFile {
  name: string;
  folder: string;
}

interface SymbolEntry {
  path: string;
  fileName: string;
  isLibrary: boolean;
  isCompiled: boolean;
  symbol: SourceSymbol;
  name: string;
  container: string;
}

function toEntry(file: FinderFile): FinderEntry {
  const index = file.path.lastIndexOf("/");
  return {
    ...file,
    name: index === -1 ? file.path : file.path.slice(index + 1),
    folder: index === -1 ? "" : file.path.slice(0, index),
  };
}

// Wraps the matched characters of the name in <mark>
function highlight(text: string, matches: readonly FuseResultMatch[] | undefined): React.ReactNode {
  const indices = matches?.find((match) => match.key === "name")?.indices;
  if (!indices || indices.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let last = 0;
  [...indices]
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, end], i) => {
      if (start < last) return;
      if (start > last) parts.push(text.slice(last, start));
      parts.push(
        <mark key={i} className="bg-transparent text-cyan-300 font-semibold">
          {text.slice(start, end + 1)}
        </mark>
      );
      last = end + 1;
    });
  parts.push(text.slice(last));
  return parts;
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-gray-600 px-1 text-[9px] uppercase tracking-wide text-gray-500">{children}</span>
);

/**
 * "Go to file": a box over the code that finds a source file by a fuzzy
 * match on its name and path (like Ctrl+P in VS Code). With "@" first, it
 * finds symbols in the open file; with "#" first, symbols in all files.
 */
export default function SourceFileFinder({
  files,
  shortcut,
  onOpen,
  onClose,
  activePath,
  getSymbols,
  symbolsVersion,
  onRequestSymbols,
  onOpenSymbol,
}: SourceFileFinderProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const mode: Mode = query.startsWith("@") ? "fileSymbols" : query.startsWith("#") ? "allSymbols" : "files";
  const text = (mode === "files" ? query : query.slice(1)).trim();

  // ---- Files ----
  const entries = useMemo(() => files.map(toEntry), [files]);
  // A match in the file name counts more than a match in the folders
  const fileFuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: [
          { name: "name", weight: 0.7 },
          { name: "path", weight: 0.3 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
      }),
    [entries]
  );

  // ---- Symbols ----
  // "#" searches the project's own compiled files first, then the rest
  const symbolPaths = useMemo(() => {
    if (mode === "fileSymbols") return activePath ? [activePath] : [];
    if (mode === "allSymbols") {
      const rank = (entry: FinderEntry) => (entry.isCompiled ? 0 : 2) + (entry.isLibrary ? 1 : 0);
      return [...entries].sort((a, b) => rank(a) - rank(b)).map((entry) => entry.path);
    }
    return [];
  }, [mode, activePath, entries]);

  useEffect(() => {
    if (symbolPaths.length) onRequestSymbols(symbolPaths);
  }, [symbolPaths, onRequestSymbols]);

  const entryByPath = useMemo(() => new Map(entries.map((entry) => [entry.path, entry])), [entries]);
  const symbolEntries = useMemo<SymbolEntry[]>(() => {
    const list: SymbolEntry[] = [];
    for (const path of symbolPaths) {
      const fileSymbols = getSymbols(path);
      if (!fileSymbols) continue;
      const fileName = path.slice(path.lastIndexOf("/") + 1);
      const file = entryByPath.get(path);
      for (const { symbol, container } of flattenSymbols(fileSymbols.symbols)) {
        list.push({
          path,
          fileName,
          isLibrary: file?.isLibrary ?? false,
          isCompiled: file?.isCompiled ?? true,
          symbol,
          name: symbol.name,
          container: container ?? "",
        });
      }
    }
    return list;
    // symbolsVersion: new symbols arrived
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolPaths, getSymbols, symbolsVersion, entryByPath]);
  const indexedFiles = symbolPaths.filter((path) => getSymbols(path)).length;

  const symbolFuse = useMemo(
    () =>
      new Fuse(symbolEntries, {
        keys: [
          { name: "name", weight: 0.85 },
          { name: "container", weight: 0.15 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        includeMatches: true,
      }),
    [symbolEntries]
  );

  type Row =
    | { type: "file"; item: FinderEntry; matches?: readonly FuseResultMatch[] }
    | { type: "symbol"; item: SymbolEntry; matches?: readonly FuseResultMatch[] };

  const rows = useMemo<Row[]>(() => {
    // Fuse finds the pattern only up to 32 characters long
    const pattern = text.slice(0, 32);
    if (mode === "files") {
      if (!pattern) {
        // Without a query: the project's own compiled files first, then library files, then other files
        const rank = (entry: FinderEntry) => (entry.isCompiled ? 0 : 2) + (entry.isLibrary ? 1 : 0);
        return [...entries]
          .sort((a, b) => rank(a) - rank(b))
          .slice(0, MAX_RESULTS)
          .map((item) => ({ type: "file" as const, item }));
      }
      return fileFuse.search(pattern, { limit: MAX_RESULTS }).map(({ item, matches }) => ({ type: "file", item, matches }));
    }
    if (!pattern) {
      // "@" alone lists the open file's symbols in order; "#" alone waits for a name
      return mode === "fileSymbols"
        ? symbolEntries.slice(0, 200).map((item) => ({ type: "symbol" as const, item }))
        : [];
    }
    return symbolFuse
      .search(pattern, { limit: MAX_RESULTS })
      .map(({ item, matches }) => ({ type: "symbol", item, matches }));
  }, [mode, text, entries, fileFuse, symbolEntries, symbolFuse]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const open = (row: Row | undefined) => {
    if (!row) return;
    if (row.type === "file") onOpen(row.item.path);
    else onOpenSymbol(row.item.path, row.item.symbol);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      open(rows[selected]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  let message: string | null = null;
  if (rows.length === 0) {
    if (mode === "files") message = "No matching files";
    else if (mode === "fileSymbols") message = !activePath ? "No file is open" : indexedFiles ? "No matching symbols" : "Finding symbols…";
    else if (!text) message = "Type the name of a contract, function, event, error, …";
    else message = indexedFiles < symbolPaths.length ? "Finding symbols…" : "No matching symbols";
  }

  return (
    <div className="absolute inset-0 z-30" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Go to file or symbol"
        className="mx-auto mt-10 w-[min(38rem,calc(100%-2rem))] rounded-md border border-gray-600 bg-gray-900 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Go to file (${shortcut}). Type @ for symbols in this file, # for symbols in all files`}
          aria-label="Go to file or symbol"
          aria-controls="source-file-finder-list"
          aria-activedescendant={rows[selected] ? `source-file-finder-${selected}` : undefined}
          spellCheck={false}
          className="w-full rounded-t-md border-b border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none"
        />
        {mode === "allSymbols" && indexedFiles < symbolPaths.length && (
          <p className="border-b border-gray-700 px-3 py-1 text-[11px] text-gray-400" role="status">
            Reading symbols: {indexedFiles} of {symbolPaths.length} files…
          </p>
        )}
        <ul ref={listRef} id="source-file-finder-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {message && <li className="px-3 py-2 text-xs text-gray-400">{message}</li>}
          {rows.map((row, index) => {
            const isSelected = index === selected;
            const common = {
              id: `source-file-finder-${index}`,
              "data-index": index,
              role: "option",
              "aria-selected": isSelected,
              onMouseMove: () => setSelected(index),
              onClick: () => open(row),
              className: `flex items-baseline gap-2 px-3 py-1 cursor-pointer text-xs ${isSelected ? "bg-cyan-900/60" : ""}`,
            };
            if (row.type === "file") {
              const { item, matches } = row;
              return (
                <li key={`file:${item.path}`} {...common}>
                  <span className={`shrink-0 ${item.isLibrary || !item.isCompiled ? "text-gray-400" : "text-gray-100"}`}>
                    {highlight(item.name, matches)}
                  </span>
                  <span className="truncate text-gray-500">{item.folder}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    {item.isLibrary && <Tag>lib</Tag>}
                    {!item.isCompiled && <Tag>other</Tag>}
                  </span>
                </li>
              );
            }
            const { item, matches } = row;
            return (
              <li
                key={`symbol:${item.path}:${item.symbol.nameRange.startLine}:${item.name}`}
                {...common}
                title={`${item.path}:${item.symbol.nameRange.startLine}`}
              >
                <span className="self-center">
                  <SymbolIcon kind={item.symbol.kind} />
                </span>
                <span className="shrink-0 text-gray-100">{highlight(item.name, matches)}</span>
                {item.symbol.detail && <span className="truncate min-w-0 text-gray-500">{item.symbol.detail}</span>}
                <span className="ml-auto flex shrink-0 items-baseline gap-2 text-gray-500">
                  {item.container}
                  {mode === "allSymbols" && <span className="text-gray-600">{item.fileName}</span>}
                  {mode === "allSymbols" && item.isLibrary && <Tag>lib</Tag>}
                  {mode === "allSymbols" && !item.isCompiled && <Tag>other</Tag>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
