"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Fuse, { FuseResultMatch } from "fuse.js";

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
}

const MAX_RESULTS = 50;

interface FinderEntry extends FinderFile {
  name: string;
  folder: string;
}

function toEntry(file: FinderFile): FinderEntry {
  const index = file.path.lastIndexOf("/");
  return {
    ...file,
    name: index === -1 ? file.path : file.path.slice(index + 1),
    folder: index === -1 ? "" : file.path.slice(0, index),
  };
}

// Wraps the matched characters of the file name in <mark>
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

/**
 * "Go to file": a box over the code that finds a source file by a fuzzy
 * match on its name and path (like Ctrl+P in VS Code).
 */
export default function SourceFileFinder({ files, shortcut, onOpen, onClose }: SourceFileFinderProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const entries = useMemo(() => files.map(toEntry), [files]);
  // A match in the file name counts more than a match in the folders
  const fuse = useMemo(
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

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Without a query: the project's own compiled files first, then library files, then other files
      const rank = (entry: FinderEntry) => (entry.isCompiled ? 0 : 2) + (entry.isLibrary ? 1 : 0);
      return [...entries]
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, MAX_RESULTS)
        .map((item) => ({ item, matches: undefined as readonly FuseResultMatch[] | undefined }));
    }
    // Fuse finds the pattern only up to 32 characters long
    return fuse.search(trimmed.slice(0, 32), { limit: MAX_RESULTS });
  }, [query, entries, fuse]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[selected];
      if (result) onOpen(result.item.path);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-30" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Go to file"
        className="mx-auto mt-10 w-[min(36rem,calc(100%-2rem))] rounded-md border border-gray-600 bg-gray-900 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Go to file (${shortcut})`}
          aria-label="Go to file"
          aria-controls="source-file-finder-list"
          aria-activedescendant={results[selected] ? `source-file-finder-${selected}` : undefined}
          spellCheck={false}
          className="w-full rounded-t-md border-b border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none"
        />
        <ul ref={listRef} id="source-file-finder-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">No matching files</li>}
          {results.map(({ item, matches }, index) => (
            <li
              key={item.path}
              id={`source-file-finder-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selected}
              onMouseMove={() => setSelected(index)}
              onClick={() => onOpen(item.path)}
              className={`flex items-baseline gap-2 px-3 py-1 cursor-pointer text-xs ${
                index === selected ? "bg-cyan-900/60" : ""
              }`}
            >
              <span className={`shrink-0 ${item.isLibrary || !item.isCompiled ? "text-gray-400" : "text-gray-100"}`}>
                {highlight(item.name, matches)}
              </span>
              <span className="truncate text-gray-500">{item.folder}</span>
              <span className="ml-auto flex shrink-0 gap-1">
                {item.isLibrary && (
                  <span className="rounded border border-gray-600 px-1 text-[9px] uppercase tracking-wide text-gray-500">
                    lib
                  </span>
                )}
                {!item.isCompiled && (
                  <span className="rounded border border-gray-600 px-1 text-[9px] uppercase tracking-wide text-gray-500">
                    other
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
