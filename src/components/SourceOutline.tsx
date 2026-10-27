"use client";

import React, { useEffect, useRef, useState } from "react";
import { VscChevronDown, VscChevronRight } from "react-icons/vsc";
import SymbolIcon, { symbolKindLabel } from "./SymbolIcon";
import { FileSymbols, SourceSymbol, symbolsAtLine } from "@/utils/sourceSymbols";

interface SourceOutlineProps {
  path: string | undefined;
  fileSymbols: FileSymbols | undefined;
  cursorLine: number | null;
  onSelect: (symbol: SourceSymbol) => void;
}

const SHORT_VISIBILITY: Record<string, string> = { external: "ext", public: "pub", internal: "int", private: "priv" };

function Badges({ symbol }: { symbol: SourceSymbol }) {
  const badges = [
    symbol.visibility ? (SHORT_VISIBILITY[symbol.visibility] ?? symbol.visibility) : null,
    symbol.mutability,
  ].filter(Boolean) as string[];
  if (badges.length === 0) return null;
  return (
    <span className="ml-auto flex shrink-0 gap-1 pl-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className={`rounded px-1 text-[9px] leading-4 ${
            badge === "payable" ? "bg-amber-900/60 text-amber-200" : "bg-gray-700 text-gray-300"
          }`}
        >
          {badge}
        </span>
      ))}
    </span>
  );
}

const keyOf = (symbol: SourceSymbol) => `${symbol.kind}:${symbol.name}:${symbol.range.startLine}`;

/**
 * The symbols of the open file: contracts with their members. A click jumps
 * to the declaration. The row of the symbol that holds the cursor is marked.
 */
export default function SourceOutline({ path, fileSymbols, cursorLine, onSelect }: SourceOutlineProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  // A new file starts with all contracts open
  useEffect(() => setCollapsed(new Set()), [path]);

  const symbols = fileSymbols?.symbols ?? [];
  const current = cursorLine !== null ? symbolsAtLine(symbols, cursorLine) : [];
  const activeKey = current.length ? keyOf(current[current.length - 1]) : null;

  // Keep the marked row in view while the cursor moves
  useEffect(() => {
    if (!activeKey) return;
    listRef.current?.querySelector<HTMLElement>(`[data-symbol-key="${CSS.escape(activeKey)}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeKey]);

  if (!path) return <p className="p-3 text-xs text-gray-500">No file is open.</p>;
  if (!fileSymbols) return <p className="p-3 text-xs text-gray-500">Finding symbols…</p>;
  if (fileSymbols.method === "none") return <p className="p-3 text-xs text-gray-500">No outline for this file type.</p>;
  if (symbols.length === 0) return <p className="p-3 text-xs text-gray-500">No symbols in this file.</p>;

  const row = (symbol: SourceSymbol, depth: number, hasChildren: boolean) => {
    const key = keyOf(symbol);
    const isCollapsed = collapsed.has(key);
    const isActive = key === activeKey;
    return (
      <button
        key={key}
        type="button"
        data-symbol-key={key}
        onClick={() => onSelect(symbol)}
        title={`${symbolKindLabel(symbol.kind)} ${symbol.name}${symbol.detail ? ` ${symbol.detail}` : ""}`}
        className={`w-full flex items-center gap-1 py-0.5 pr-2 text-left text-xs outline-none cursor-pointer ${
          isActive ? "bg-cyan-900/50 text-white" : "text-gray-300 hover:bg-gray-700/60 focus:bg-gray-700"
        }`}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        {hasChildren ? (
          <span
            role="button"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((previous) => {
                const next = new Set(previous);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            className="shrink-0 text-gray-400 hover:text-white"
          >
            {isCollapsed ? <VscChevronRight className="w-3.5 h-3.5" /> : <VscChevronDown className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <SymbolIcon kind={symbol.kind} />
        <span className="shrink-0">{symbol.name}</span>
        {symbol.detail && <span className="truncate min-w-0 text-gray-500">{symbol.detail}</span>}
        <Badges symbol={symbol} />
      </button>
    );
  };

  return (
    <div ref={listRef} className="h-full overflow-y-auto py-1">
      {fileSymbols.method === "regex" && path.endsWith(".sol") && (
        <p className="px-2 pb-1 text-[10px] text-amber-400/80">
          The parser could not read this file. This outline comes from a simple scan and can miss symbols.
        </p>
      )}
      {symbols.map((symbol) => {
        const children = symbol.children ?? [];
        return (
          <React.Fragment key={keyOf(symbol)}>
            {row(symbol, 0, children.length > 0)}
            {!collapsed.has(keyOf(symbol)) && children.map((child) => row(child, 1, false))}
          </React.Fragment>
        );
      })}
    </div>
  );
}
