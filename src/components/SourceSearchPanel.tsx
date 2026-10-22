"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  VscCaseSensitive,
  VscChevronDown,
  VscChevronRight,
  VscCollapseAll,
  VscExpandAll,
  VscRegex,
  VscWholeWord,
} from "react-icons/vsc";
import { SearchMatch, SearchOptions, SearchResult } from "@/utils/sourceSearch";

export interface ActiveSearchMatch {
  path: string;
  match: SearchMatch;
}

interface SourceSearchPanelProps {
  options: SearchOptions;
  onOptionsChange: (options: SearchOptions) => void;
  // Null while the query is empty or the search waits for typing to stop
  result: SearchResult | null;
  error: string | null;
  fileCount: number;
  activeMatch: ActiveSearchMatch | null;
  onOpenMatch: (path: string, match: SearchMatch) => void;
  // Called on Esc in the search box; the parent moves focus back to the editor
  onEscape: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const TOGGLES: Array<{
  key: "matchCase" | "wholeWord" | "regex";
  label: string;
  shortcut: string;
  code: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: "matchCase", label: "Match Case", shortcut: "Alt+C", code: "KeyC", Icon: VscCaseSensitive },
  { key: "wholeWord", label: "Match Whole Word", shortcut: "Alt+W", code: "KeyW", Icon: VscWholeWord },
  { key: "regex", label: "Use Regular Expression", shortcut: "Alt+R", code: "KeyR", Icon: VscRegex },
];

// A long line shows only a short part before the match, so that the match stays visible
const CONTEXT_BEFORE_MATCH = 20;

// Runs of spaces and tabs (for example comment alignment) show as one space
const collapseSpaces = (text: string) => text.replace(/[ \t]+/g, " ");

function previewParts(match: SearchMatch): { before: string; hit: string; after: string } {
  const text = match.lineText;
  const start = match.startColumn - 1;
  const end = match.endLine === match.startLine ? match.endColumn - 1 : text.length;
  let before = collapseSpaces(text.slice(0, start)).trimStart();
  if (before.length > CONTEXT_BEFORE_MATCH) before = "…" + before.slice(-CONTEXT_BEFORE_MATCH).trimStart();
  return { before, hit: text.slice(start, end), after: collapseSpaces(text.slice(end)) };
}

function splitPath(path: string): { name: string; folder: string } {
  const index = path.lastIndexOf("/");
  return index === -1 ? { name: path, folder: "" } : { name: path.slice(index + 1), folder: path.slice(0, index) };
}

const isSameMatch = (a: ActiveSearchMatch | null, path: string, match: SearchMatch) =>
  !!a && a.path === path && a.match.startLine === match.startLine && a.match.startColumn === match.startColumn;

export default function SourceSearchPanel({
  options,
  onOptionsChange,
  result,
  error,
  fileCount,
  activeMatch,
  onOpenMatch,
  onEscape,
  inputRef,
}: SourceSearchPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  // A new result list starts with every file open
  useEffect(() => {
    setCollapsed(new Set());
  }, [result]);

  const toggle = (key: (typeof TOGGLES)[number]["key"]) => onOptionsChange({ ...options, [key]: !options[key] });

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-search-row]") ?? []);

  const focusRow = (index: number) => {
    const all = rows();
    if (all.length === 0) return;
    all[Math.max(0, Math.min(index, all.length - 1))].focus();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey) {
      const option = TOGGLES.find((t) => t.code === event.code);
      if (option) {
        event.preventDefault();
        toggle(option.key);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const first = result?.files[0];
      if (first) onOpenMatch(first.path, first.matches[0]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const all = rows();
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusRow(index - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  const toggleFile = (path: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const allCollapsed = !!result && result.files.length > 0 && result.files.every((f) => collapsed.has(f.path));

  let status: string;
  if (error) status = error;
  else if (!options.query) status = `Search in all ${fileCount} files`;
  else if (!result) status = "Searching…";
  else if (result.total === 0) status = "No results";
  else
    status = `${result.total.toLocaleString()}${result.truncated ? "+" : ""} result${result.total === 1 ? "" : "s"} in ${
      result.files.length
    } file${result.files.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col h-full min-h-0 text-gray-300">
      <div className="p-2 border-b border-gray-700">
        <div className="flex items-center rounded border border-gray-600 bg-gray-900 focus-within:border-cyan-500">
          <input
            ref={inputRef}
            type="text"
            value={options.query}
            onChange={(event) => onOptionsChange({ ...options, query: event.target.value })}
            onKeyDown={onInputKeyDown}
            placeholder="Search"
            aria-label="Search in all source files"
            spellCheck={false}
            className="flex-1 min-w-0 bg-transparent px-2 py-1 text-xs text-gray-100 placeholder-gray-500 outline-none font-mono"
          />
          {TOGGLES.map(({ key, label, shortcut, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={options[key]}
              aria-label={label}
              data-tooltip-id="global-tooltip"
              data-tooltip-content={`${label} (${shortcut})`}
              className={`mx-0.5 p-0.5 rounded cursor-pointer ${
                options[key]
                  ? "bg-cyan-700/60 text-white ring-1 ring-cyan-500"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mt-1.5 min-h-5">
          <span
            role="status"
            aria-live="polite"
            className={`text-[11px] ${error ? "text-red-400" : "text-gray-400"} truncate`}
            title={status}
          >
            {status}
          </span>
          {result && result.files.length > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(result.files.map((f) => f.path)))}
              className="p-0.5 rounded text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer"
              aria-label={allCollapsed ? "Expand all" : "Collapse all"}
              data-tooltip-id="global-tooltip"
              data-tooltip-content={allCollapsed ? "Expand all" : "Collapse all"}
            >
              {allCollapsed ? <VscExpandAll className="w-4 h-4" /> : <VscCollapseAll className="w-4 h-4" />}
            </button>
          )}
        </div>
        {result?.truncated && (
          <p className="mt-1 text-[11px] text-amber-400">
            The search stopped at {result.total.toLocaleString()} results. Type more to narrow it.
          </p>
        )}
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-1" onKeyDown={onListKeyDown}>
        {result?.files.map(({ path, matches }) => {
          const { name, folder } = splitPath(path);
          const isCollapsed = collapsed.has(path);
          return (
            <div key={path}>
              <button
                type="button"
                data-search-row
                onClick={() => toggleFile(path)}
                aria-expanded={!isCollapsed}
                title={path}
                className="w-full flex items-center gap-1 px-1 py-0.5 text-left text-xs hover:bg-gray-700/60 focus:bg-gray-700 outline-none cursor-pointer"
              >
                {isCollapsed ? (
                  <VscChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                ) : (
                  <VscChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                )}
                <span className="text-gray-100 shrink-0">{name}</span>
                <span className="text-gray-500 truncate min-w-0">{folder}</span>
                <span className="ml-auto shrink-0 rounded-full bg-gray-700 px-1.5 text-[10px] text-gray-300">
                  {matches.length}
                </span>
              </button>
              {!isCollapsed &&
                matches.map((match) => {
                  const { before, hit, after } = previewParts(match);
                  const active = isSameMatch(activeMatch, path, match);
                  return (
                    <button
                      key={`${match.startLine}:${match.startColumn}`}
                      type="button"
                      data-search-row
                      onClick={() => onOpenMatch(path, match)}
                      title={`Line ${match.startLine}`}
                      className={`w-full flex items-baseline gap-2 pl-6 pr-2 py-0.5 text-left text-xs font-mono outline-none cursor-pointer ${
                        active ? "bg-cyan-900/60 text-white" : "hover:bg-gray-700/60 focus:bg-gray-700"
                      }`}
                    >
                      <span className="shrink-0 w-8 text-right text-[10px] text-gray-500">{match.startLine}</span>
                      <span className="truncate whitespace-pre">
                        {before}
                        <mark className="bg-amber-500/40 text-gray-50 rounded-[2px]">{hit}</mark>
                        {after}
                      </span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
