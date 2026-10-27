"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { VscArrowRight, VscArrowLeft, VscClose } from "react-icons/vsc";
import { useRegisteredSources } from "@/utils/sourceRegistry";
import { formatSourceHash } from "@/utils/sourceHash";
import { lineStarts } from "@/utils/sourceSearch";
import { createUtf8Mapper, decodeSourceMap, disassemble, pathsByFileIndex } from "@/utils/sourceMap";

interface BytecodeOpcodesProps {
  bytecode: string;
  sourceMap?: string;
  sourceIds?: Record<string, { id: number }>;
  // Instruction indexes to mark (from "Show in Bytecode"), with a label for the banner
  highlight: { indexes: number[]; label: string } | null;
  onClearHighlight: () => void;
}

const ROW_HEIGHT = 20;
const VIEW_HEIGHT = 320;
const OVERSCAN = 10;

const shortHex = (value: string) => (value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value);

/**
 * The bytecode as a list of instructions: offset, opcode, pushed value, and
 * the source location from the compiler's source map. A click on a row with a
 * location opens the Source Code section with that exact range highlighted.
 */
export default function BytecodeOpcodes({
  bytecode,
  sourceMap,
  sourceIds,
  highlight,
  onClearHighlight,
}: BytecodeOpcodesProps) {
  const instructions = useMemo(() => disassemble(bytecode), [bytecode]);
  const entries = useMemo(() => decodeSourceMap(sourceMap ?? ""), [sourceMap]);
  const paths = useMemo(() => pathsByFileIndex(sourceIds), [sourceIds]);
  const sources = useRegisteredSources();

  // Line numbers and snippets need the file text; prepare each file once, on first use
  const fileCache = useRef(
    new Map<string, { mapper: ReturnType<typeof createUtf8Mapper>; starts: number[]; text: string }>()
  );
  const fileInfo = (path: string) => {
    const text = sources?.[path]?.content;
    if (text === undefined) return undefined;
    let info = fileCache.current.get(path);
    if (!info || info.text !== text) {
      info = { mapper: createUtf8Mapper(text), starts: lineStarts(text), text };
      fileCache.current.set(path, info);
    }
    return info;
  };
  const lineOf = (starts: number[], index: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= index) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };

  const highlighted = useMemo(() => new Set(highlight?.indexes ?? []), [highlight]);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // A new highlight scrolls the list to its first instruction
  useEffect(() => {
    const first = highlight?.indexes[0];
    if (first === undefined || !listRef.current) return;
    listRef.current.scrollTop = Math.max(0, first * ROW_HEIGHT - VIEW_HEIGHT / 3);
  }, [highlight]);

  const mappedCount = entries.filter((entry) => entry.fileIndex >= 0 && paths.has(entry.fileIndex)).length;
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(instructions.length, Math.ceil((scrollTop + VIEW_HEIGHT) / ROW_HEIGHT) + OVERSCAN);

  const location = (index: number) => {
    const entry = entries[index];
    if (!entry) return { kind: "none" as const };
    if (entry.fileIndex < 0 || entry.start < 0) return { kind: "generated" as const };
    const path = paths.get(entry.fileIndex);
    // Ids that sourceIds does not list are sources that the compiler generates (Yul utility code)
    if (!path) return { kind: "generated" as const };
    const info = fileInfo(path);
    if (!info) return { kind: "source" as const, path, entry };
    const startIndex = info.mapper.byteToIndex(entry.start);
    const endIndex = info.mapper.byteToIndex(entry.start + entry.length);
    const snippet = info.text.slice(startIndex, endIndex).split("\n")[0].replace(/\s+/g, " ").trim();
    return { kind: "source" as const, path, entry, line: lineOf(info.starts, startIndex), snippet };
  };

  const open = (path: string, start: number, length: number) => {
    window.location.hash = formatSourceHash({ file: path, range: { start, end: start + length } });
  };

  return (
    <div className="rounded border border-gray-200 bg-gray-50 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-1.5 font-sans text-gray-600">
        <span>
          {instructions.length.toLocaleString()} instructions
          {sourceMap ? ` · ${mappedCount.toLocaleString()} mapped to a source file` : " · no source map"}
        </span>
        {highlight && (
          <span className="inline-flex items-center gap-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900">
            {highlight.indexes.length} instruction{highlight.indexes.length === 1 ? "" : "s"} from {highlight.label}
            <button
              type="button"
              onClick={onClearHighlight}
              className="rounded p-0.5 hover:bg-amber-200 cursor-pointer"
              aria-label="Clear the highlight"
            >
              <VscClose className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
      <div
        ref={listRef}
        className="overflow-y-auto"
        style={{ height: VIEW_HEIGHT }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="list"
        aria-label="Bytecode instructions"
      >
        <div style={{ height: instructions.length * ROW_HEIGHT, position: "relative" }}>
          {instructions.slice(firstRow, lastRow).map((instruction, i) => {
            const index = firstRow + i;
            const where = location(index);
            const clickable = where.kind === "source";
            const jump = entries[index]?.jump;
            return (
              <div
                key={index}
                role="listitem"
                onClick={clickable ? () => open(where.path, where.entry.start, where.entry.length) : undefined}
                title={clickable ? `Show in the source: ${where.path}${where.line ? `:${where.line}` : ""}` : undefined}
                className={`absolute left-0 right-0 flex items-center gap-3 px-3 whitespace-nowrap ${
                  highlighted.has(index) ? "bg-amber-200/70" : clickable ? "hover:bg-cyan-50" : ""
                } ${clickable ? "cursor-pointer" : ""}`}
                style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <span className="w-14 shrink-0 text-gray-400">
                  0x{instruction.offset.toString(16).padStart(4, "0")}
                </span>
                <span className="w-56 shrink-0 truncate text-gray-800">
                  <span className={instruction.opcode.startsWith("PUSH") ? "text-purple-700" : ""}>
                    {instruction.opcode}
                  </span>
                  {instruction.pushData && (
                    <span className="ml-1.5 text-gray-500" title={instruction.pushData}>
                      {shortHex(instruction.pushData)}
                    </span>
                  )}
                </span>
                <span className="w-4 shrink-0 text-gray-400">
                  {jump === "i" && (
                    <span data-tooltip-id="global-tooltip" data-tooltip-content="Jump into a function">
                      <VscArrowRight className="w-3 h-3" />
                    </span>
                  )}
                  {jump === "o" && (
                    <span data-tooltip-id="global-tooltip" data-tooltip-content="Return from a function">
                      <VscArrowLeft className="w-3 h-3" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate font-sans">
                  {where.kind === "source" && (
                    <>
                      <span className="text-cyan-700">
                        {where.path.split("/").pop()}
                        {where.line ? `:${where.line}` : ""}
                      </span>
                      {where.snippet && <span className="ml-2 font-mono text-gray-500">{where.snippet}</span>}
                    </>
                  )}
                  {where.kind === "generated" && <span className="italic text-gray-400">compiler-generated</span>}
                  {where.kind === "none" && <span className="italic text-gray-400">no source map entry</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
