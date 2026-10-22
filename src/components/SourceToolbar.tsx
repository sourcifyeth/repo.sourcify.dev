"use client";

import { useEffect, useRef, useState } from "react";
import { FaCheck, FaLink, FaRegCopy, FaRegQuestionCircle } from "react-icons/fa";
import { MdWrapText } from "react-icons/md";
import { VscGoToFile, VscScreenFull, VscScreenNormal } from "react-icons/vsc";
import { formatSourceHash } from "@/utils/sourceHash";
import type { SourceShortcuts } from "@/utils/shortcuts";

interface SourceToolbarProps {
  path: string;
  // Returns the link to copy. The source view also writes it to the address bar.
  getLink: () => string;
  fileContent: string;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  onOpenFinder: () => void;
  shortcuts: SourceShortcuts;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  // The help sheet: the parent owns its state, so that the status bar can open it too
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}

type Copied = "link" | "file" | null;

const buttonClass =
  "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer";

export default function SourceToolbar({
  path,
  getLink,
  fileContent,
  wordWrap,
  onToggleWordWrap,
  onOpenFinder,
  shortcuts,
  isFullscreen,
  onToggleFullscreen,
  helpOpen,
  onHelpOpenChange,
}: SourceToolbarProps) {
  const [copied, setCopied] = useState<Copied>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const helpRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Close the help popover on Esc or on a click outside it
  useEffect(() => {
    if (!helpOpen) return;
    // Capture phase, and preventDefault: this Esc closes only the popover, not fullscreen
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onHelpOpenChange(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) onHelpOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [helpOpen, onHelpOpenChange]);

  const copy = async (what: Exclude<Copied, null>, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-gray-800 border-b border-gray-700 px-2 py-1">
      <span className="flex-1 min-w-0 truncate text-xs text-gray-400 font-mono" title={path}>
        {path}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={onOpenFinder}
        data-tooltip-id="global-tooltip"
        data-tooltip-content={`Go to a file by name (${shortcuts.goToFile})`}
      >
        <VscGoToFile className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Go to file</span>
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => copy("link", getLink())}
        data-tooltip-id="global-tooltip"
        data-tooltip-content="Copy a link to this file and the selected lines"
      >
        {copied === "link" ? <FaCheck className="w-3 h-3 text-green-400" /> : <FaLink className="w-3 h-3" />}
        <span className="hidden sm:inline">{copied === "link" ? "Copied!" : "Copy link"}</span>
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => copy("file", fileContent)}
        data-tooltip-id="global-tooltip"
        data-tooltip-content="Copy the content of this file"
      >
        {copied === "file" ? <FaCheck className="w-3 h-3 text-green-400" /> : <FaRegCopy className="w-3 h-3" />}
        <span className="hidden sm:inline">{copied === "file" ? "Copied!" : "Copy file"}</span>
      </button>
      <button
        type="button"
        className={`${buttonClass} ${wordWrap ? "bg-gray-700 text-white" : ""}`}
        onClick={onToggleWordWrap}
        aria-pressed={wordWrap}
        data-tooltip-id="global-tooltip"
        data-tooltip-content={wordWrap ? "Word wrap is on" : "Word wrap is off"}
      >
        <MdWrapText className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Wrap</span>
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={onToggleFullscreen}
        aria-pressed={isFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        data-tooltip-id="global-tooltip"
        data-tooltip-content={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
      >
        {isFullscreen ? <VscScreenNormal className="w-3.5 h-3.5" /> : <VscScreenFull className="w-3.5 h-3.5" />}
      </button>

      <div className="relative" ref={helpRef}>
        <button
          type="button"
          className={`${buttonClass} ${helpOpen ? "bg-gray-700 text-white" : ""}`}
          onClick={() => onHelpOpenChange(!helpOpen)}
          aria-expanded={helpOpen}
          aria-controls="source-link-help"
          aria-label="Shortcuts and links"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Shortcuts and links"
        >
          <FaRegQuestionCircle className="w-3.5 h-3.5" />
        </button>
        {helpOpen && (
          <div
            id="source-link-help"
            role="dialog"
            aria-label="Shortcuts and links"
            className="absolute right-0 top-full mt-1 z-20 w-96 max-w-[calc(100vw-2rem)] max-h-[min(70vh,34rem)] overflow-y-auto rounded-md border border-gray-600 bg-gray-900 p-3 text-xs text-gray-200 shadow-lg"
          >
            <p className="font-semibold text-white mb-1">Keyboard shortcuts</p>
            <p className="mb-2 text-gray-400">They work while the focus is in the Source Code section.</p>
            <table className="w-full mb-3">
              <tbody>
                {(
                  [
                    ["Go to a file by name", shortcuts.goToFile],
                    ["Go to a symbol in this file", `${shortcuts.goToSymbol}, or ${shortcuts.goToFile} then @`],
                    ["Go to a symbol in all files", `${shortcuts.goToFile} then #`],
                    ["Search in all files", shortcuts.searchAll],
                    [
                      "Match case, whole word, regex",
                      `${shortcuts.matchCase}, ${shortcuts.wholeWord}, ${shortcuts.regex} in the search box`,
                    ],
                    ["Find in this file", shortcuts.findInFile],
                    ["Open an imported file", `${shortcuts.openImport} on the import path`],
                    ["Leave fullscreen", "Esc"],
                  ] as const
                ).map(([action, keys]) => (
                  <tr key={action} className="align-top">
                    <td className="py-0.5 pr-3 text-gray-300">{action}</td>
                    <td className="py-0.5 text-right">
                      <kbd className="font-sans text-white">{keys}</kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="font-semibold text-white mb-2">Link to lines</p>
            <ul className="list-disc pl-4 space-y-1 mb-3">
              <li>Click a line number to select that line.</li>
              <li>Shift+click a second line number to select a range.</li>
              <li>
                The address bar updates. To share the link, click <span className="font-semibold">Copy link</span>.
              </li>
              <li>
                You can also select code and right-click it. Then choose{" "}
                <span className="font-semibold">Copy Link to Selected Lines</span>.
              </li>
            </ul>
            <p className="font-semibold text-white mb-1">Link format</p>
            <p className="mb-1">Add this to the contract page address:</p>
            <code className="block break-all rounded bg-gray-800 px-2 py-1 font-mono text-[11px] text-gray-100">
              {formatSourceHash({ file: path, lines: { start: 10, end: 20 } })}
            </code>
            <p className="mt-2 text-gray-400">
              <span className="font-mono">L=10</span> selects one line. Without <span className="font-mono">L</span>, the
              link opens the file only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
