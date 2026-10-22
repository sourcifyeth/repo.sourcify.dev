"use client";

import React from "react";
import type { SourceShortcuts } from "@/utils/shortcuts";

interface SourceStatusBarProps {
  line: number | null;
  column: number | null;
  language: string;
  shortcuts: SourceShortcuts;
  onGoToFile: () => void;
  onSearchAll: () => void;
  onGoToSymbol: () => void;
  onOpenHelp: () => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  solidity: "Solidity",
  vyper: "Vyper",
  rust: "Fe",
  plaintext: "Plain text",
};

function Hint({ keys, label, onClick }: { keys: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1 hover:bg-gray-700 hover:text-white cursor-pointer"
    >
      <kbd className="font-sans text-gray-300">{keys}</kbd>
      <span>{label}</span>
    </button>
  );
}

/**
 * A thin bar under the code, like VS Code's status bar: the cursor position
 * and the language on the left, and the main shortcuts on the right. Each
 * shortcut is also a button. On small screens (no keyboard), only the
 * position shows.
 */
export default function SourceStatusBar({
  line,
  column,
  language,
  shortcuts,
  onGoToFile,
  onSearchAll,
  onGoToSymbol,
  onOpenHelp,
}: SourceStatusBarProps) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between gap-3 border-t border-gray-700 bg-gray-900 px-2 text-[11px] text-gray-400">
      <span className="shrink-0 whitespace-nowrap">
        {line !== null && column !== null ? `Ln ${line}, Col ${column}` : ""}
        <span className="mx-1.5 text-gray-600">·</span>
        {LANGUAGE_NAMES[language] ?? language}
      </span>
      <span className="hidden md:flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
        <Hint keys={shortcuts.goToFile} label="files" onClick={onGoToFile} />
        <span className="text-gray-600">·</span>
        <Hint keys={shortcuts.searchAll} label="search" onClick={onSearchAll} />
        <span className="text-gray-600">·</span>
        <Hint keys={shortcuts.goToSymbol} label="symbols" onClick={onGoToSymbol} />
        <span className="text-gray-600">·</span>
        <Hint keys="?" label="all shortcuts" onClick={onOpenHelp} />
      </span>
    </div>
  );
}
