"use client";

import { useEffect, useRef, useState } from "react";
import { IoChevronForward, IoWarningOutline } from "react-icons/io5";
import { type Fn, isRead } from "@/utils/interact/abi";
import type { CallContext } from "@/utils/interact/types";
import { DataSources, useSources } from "./DataSources";
import { ProxyNote, keepSelectedTabInView, useOpenRows } from "./Frame";
import FunctionPanel from "./FunctionPanel";
import { EmptyFunctions, FunctionDetails, FunctionName, functionFromUrl } from "./FunctionRow";
import { type ContractInteractionProps, useContractFunctions } from "./useContractFunctions";
import { WalletChip, useWallet } from "./Wallet";
import { KindBadge, Segmented, SearchInput, SelectorChip, buttonQuiet, matchesSearch } from "./ui";

type Filter = "all" | "read" | "write";

/**
 * The functions of the contract, in the manner of Blockscout: one list with an All / Read / Write filter.
 * Each row shows the name, a read or write mark and the selector, and opens in place.
 * The box has a limited height; the list scrolls inside it.
 */
export default function FunctionList(props: ContractInteractionProps) {
  const sources = useSources();
  const wallet = useWallet();
  const set = useContractFunctions(props, sources.chain?.explorers[0]);
  const rows = useOpenRows();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A function opened by a link (?fn=): scroll the page so that its row is at the top, below the sticky banner
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  // Rows that the user opened one at a time. Only these read at once: "Expand all" must not start a read for every row.
  const [openedOne, setOpenedOne] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!scrollTo) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${scrollTo}"]`);
    if (!row) return;
    // A hidden tab (built in the background) has no position: scroll when it shows
    if (row.offsetParent !== null) {
      const root = document.documentElement;
      const banner = parseFloat(getComputedStyle(root).getPropertyValue("--sticky-banner-height")) || 0;
      window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - banner - 8 });
    }
    setScrollTo(null);
  }, [scrollTo, rows.open]);
  useEffect(() => keepSelectedTabInView(tabsRef.current), [set.source]);

  useEffect(() => {
    const fn = functionFromUrl(set.functions);
    if (fn) {
      rows.toggle([fn.id], true);
      setOpenedOne((current) => new Set(current).add(fn.id));
      setScrollTo(fn.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.functions]);

  const ordered = [...set.functions].sort((a, b) => a.name.localeCompare(b.name));
  const byKind = ordered.filter((fn) => filter === "all" || (filter === "read") === isRead(fn));
  const visible = byKind.filter((fn) => matchesSearch(fn, query));
  const anyOpen = visible.some((fn) => rows.open.has(fn.id));
  const proxyChoice = set.isProxy && set.implementationVerified;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Which contract's ABI, and the two section-wide controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
        {proxyChoice ? (
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Which ABI"
            className="-mx-1 flex max-w-full flex-nowrap gap-1.5 overflow-x-auto px-1 [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:mx-0 sm:flex-wrap sm:px-0 sm:[mask-image:none]"
          >
            {(
              [
                ["implementation", "Read/Write as proxy", set.counts.implementation],
                ["own", "Read/Write contract", set.counts.own],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={set.source === value}
                onClick={() => set.setSource(value)}
                className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 ${
                  set.source === value
                    ? "border-cerulean-blue-200 bg-cerulean-blue-100 font-medium text-cerulean-blue-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {label}
                <span className="text-xs text-gray-500">{count}</span>
              </button>
            ))}
          </div>
        ) : (
          <h3 className="text-sm font-medium text-gray-800">Contract functions</h3>
        )}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <DataSources compact />
          <WalletChip chainName={set.ctx.chainName} />
        </div>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        {wallet.problem && (
          <p
            role="alert"
            className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm text-yellow-900"
          >
            {wallet.problem}
          </p>
        )}
        {props.warnings.map((warning) => (
          <p key={warning} className="flex items-start gap-1.5 text-sm leading-5 text-amber-800">
            <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {warning}
          </p>
        ))}
        {set.isProxy && <ProxyNote set={set} />}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: <>All {set.functions.length}</> },
              { value: "read", label: <>Read {set.reads.length}</> },
              { value: "write", label: <>Write {set.writes.length}</> },
            ]}
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by name or selector"
            className="w-full sm:w-72"
          />
          {visible.length > 0 && (
            <button
              type="button"
              className={`${buttonQuiet} ml-auto whitespace-nowrap`}
              onClick={() =>
                rows.toggle(
                  visible.map((fn) => fn.id),
                  !anyOpen
                )
              }
            >
              {anyOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      </div>

      {set.implementation.status === "loading" ? (
        <p className="border-t border-gray-200 px-4 py-10 text-center text-sm text-gray-500">Loading the functions…</p>
      ) : set.functions.length === 0 ? (
        <EmptyFunctions kind="any" />
      ) : visible.length === 0 ? (
        <EmptyFunctions kind={filter === "all" ? "any" : filter} query={query || undefined} />
      ) : (
        <div ref={listRef} className="relative rounded-b-lg border-t border-gray-200">
          <ol className="divide-y divide-gray-200">
            {visible.map((fn) => (
              <Row
                key={fn.id}
                fn={fn}
                isOpen={rows.open.has(fn.id)}
                isMounted={rows.mounted.has(fn.id)}
                onToggle={() => {
                  const opening = !rows.open.has(fn.id);
                  rows.toggle([fn.id], opening);
                  if (opening) setOpenedOne((current) => new Set(current).add(fn.id));
                }}
                autoRead={rows.open.has(fn.id) && openedOne.has(fn.id)}
                ctx={set.ctx}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Row({
  fn,
  isOpen,
  isMounted,
  onToggle,
  ctx,
  autoRead,
}: {
  fn: Fn;
  autoRead: boolean;
  isOpen: boolean;
  isMounted: boolean;
  onToggle: () => void;
  ctx: CallContext;
}) {
  const panelId = `panel-${fn.id}`;
  return (
    // The open function gets a bar on its left edge, over its title, form and result
    <li
      data-row={fn.id}
      className={`border-l-[3px] ${isOpen ? "border-cerulean-blue-500 bg-gray-100" : "border-transparent"}`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex min-h-9 w-full cursor-pointer flex-nowrap items-center gap-x-2 px-4 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cerulean-blue-500 ${isOpen ? "hover:bg-gray-200/60" : "hover:bg-gray-50"}`}
      >
        <FunctionName fn={fn} mono size="text-[13px]" bold={isOpen} />
        <KindBadge fn={fn} />
        <span className="hidden sm:inline-flex">
          <SelectorChip fn={fn} focusable={false} />
        </span>
        <IoChevronForward
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
        />
      </button>
      {isMounted && (
        // The panel slides open: the grid row grows from 0fr to 1fr, so the height of the content need not be known.
        // `starting:` animates the first open too (the panel mounts open). A closed panel is inert: no focus, no screen reader.
        <div
          id={panelId}
          inert={!isOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
            isOpen
              ? "grid-rows-[1fr] opacity-100 starting:grid-rows-[0fr] starting:opacity-0"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            {/* Indented under the function name, so that the content reads as part of this row */}
            <div className="pb-4 pl-7 pr-4 sm:pl-10">
              <FunctionDetails fn={fn} showSelector={false} />
              <FunctionPanel fn={fn} ctx={ctx} autoRead={autoRead} />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
