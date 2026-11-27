"use client";

import { useEffect, useRef, useState } from "react";
import { IoBookOutline, IoChevronForward, IoWarningOutline } from "react-icons/io5";
import { type Fn, isRead } from "@/utils/interact/abi";
import type { CallContext } from "@/utils/interact/types";
import { DataSources, useSources } from "./DataSources";
import { ProxyNote, keepSelectedTabInView, useOpenRows } from "./Frame";
import FunctionPanel, { type FormKind } from "./FunctionPanel";
import { EmptyFunctions, FunctionDetails, FunctionName } from "./FunctionRow";
import { FunctionDocsContext } from "./NatSpecDisplay";
import { type ClearSigning, useClearSigning } from "./useClearSigning";
import { type ContractInteractionProps, useContractFunctions } from "./useContractFunctions";
import { SafetyLine, WalletChip, useWallet } from "./Wallet";
import { KindBadge, Segmented, SearchInput, SelectorChip, buttonQuiet, matchesSearch } from "./ui";

type Filter = "all" | "read" | "write";

/**
 * The functions of the contract, in the manner of Blockscout: one list with an All / Read / Write filter.
 * Each row shows the name, a read or write mark and the selector, and opens in place.
 * The list has no height limit: it scrolls with the page.
 */
export default function FunctionList(props: ContractInteractionProps) {
  const sources = useSources();
  const wallet = useWallet();
  const set = useContractFunctions(props, sources.chain?.explorers[0]);
  const clearSigning = useClearSigning(props.chainId, props.address, set);
  const rows = useOpenRows();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);
  // Rows that the user opened one at a time. Only these read at once: "Expand all" must not start a read for every row.
  const [openedOne, setOpenedOne] = useState<Set<string>>(new Set());
  useEffect(() => keepSelectedTabInView(tabsRef.current), [set.source]);
  const ordered = [...set.functions].sort((a, b) => a.name.localeCompare(b.name));
  const byKind = ordered.filter((fn) => filter === "all" || (filter === "read") === isRead(fn));
  const visible = byKind.filter((fn) => matchesSearch(fn, query));
  const anyOpen = visible.some((fn) => rows.open.has(fn.id));
  // Functions with a clear signing form come first, as their own group
  const withClear = visible.filter((fn) => clearSigning.of(fn.id));
  const withoutClear = visible.filter((fn) => !clearSigning.of(fn.id));
  const groups =
    withClear.length > 0
      ? [
          { title: "ERC-7730 Clear Signing", functions: withClear },
          { title: "ABI Encoded", functions: withoutClear },
        ].filter((group) => group.functions.length > 0)
      : [{ title: null, functions: visible }];
  const proxyChoice = set.isProxy && set.implementationVerified;

  return (
    <>
      {/* Once for the whole tab, above the list: not repeated in each function */}
      <div className="mb-3">
        <SafetyLine />
      </div>
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
          <p className="border-t border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
            Loading the functions…
          </p>
        ) : set.functions.length === 0 ? (
          <EmptyFunctions kind="any" />
        ) : visible.length === 0 ? (
          <EmptyFunctions kind={filter === "all" ? "any" : filter} query={query || undefined} />
        ) : (
          <div className="relative rounded-b-lg border-t border-gray-200">
            {groups.map((group, index) => (
              // A group: a title with a line under it over the full width, then its rows. Space sets the groups apart.
              <section
                key={group.title ?? "all"}
                aria-label={group.title ?? undefined}
                className={index > 0 ? "mt-8" : undefined}
              >
                {group.title && (
                  <h3 className="flex items-baseline gap-2 border-b border-gray-300 px-4 pb-2 pt-4 text-[15px] font-semibold text-gray-900">
                    {group.title}
                    <span className="text-sm font-normal text-gray-500">{group.functions.length}</span>
                  </h3>
                )}
                {/* Each function is a card. The cards sit inside the box, with space around and between them.
                    From 1024 px the cards of a group are in two columns, the first half on the left and the
                    second half on the right. Each column is its own stack, so an open card pushes down only
                    the cards under it. */}
                <div className="grid items-start gap-2.5 px-2 py-3 sm:px-4 lg:grid-cols-2">
                  {(group.functions.length > 1
                    ? [
                        group.functions.slice(0, Math.ceil(group.functions.length / 2)),
                        group.functions.slice(Math.ceil(group.functions.length / 2)),
                      ]
                    : [group.functions]
                  ).map((column, columnIndex) => (
                    <ol key={columnIndex} className="min-w-0 space-y-2.5">
                      {column.map((fn) => (
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
                          clear={clearSigning.of(fn.id)}
                        />
                      ))}
                    </ol>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Row({
  fn,
  isOpen,
  isMounted,
  onToggle,
  ctx,
  autoRead,
  clear,
}: {
  fn: Fn;
  autoRead: boolean;
  clear?: ClearSigning;
  isOpen: boolean;
  isMounted: boolean;
  onToggle: () => void;
  ctx: CallContext;
}) {
  const panelId = `panel-${fn.id}`;
  // The NatSpec notes of this function are hidden until the user clicks "Show Docs"
  const [docsOpen, setDocsOpen] = useState(false);
  // A function with a descriptor shows its clear signing form first; the switch in the card turns it off
  const [wantedForm, setWantedForm] = useState<FormKind>("clear");
  const hasDocs =
    !!fn.notice || !!fn.dev || Object.keys(fn.paramDocs).length > 0 || Object.keys(fn.returnDocs).length > 0;
  return (
    // Each function is a card with a full border. The open card has the grey fill and a darker border.
    <li
      className={`rounded-lg border transition-colors ${isOpen ? "border-gray-400 bg-gray-100" : "border-gray-300 bg-white hover:border-gray-400"}`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex w-full cursor-pointer flex-nowrap items-center gap-x-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cerulean-blue-500 ${isOpen ? "rounded-t-[7px] hover:bg-gray-200/60" : "rounded-[7px] hover:bg-gray-50"} min-h-10 px-3 py-2 sm:px-4`}
      >
        <FunctionName fn={fn} mono size="text-[13px]" bold={isOpen} />
        <KindBadge fn={fn} />
        {clear && (
          <span
            className="inline-flex shrink-0 items-center rounded bg-green-50 px-1.5 text-xs leading-5 text-green-800"
            data-tooltip-id="global-tooltip"
            data-tooltip-content="This function has a clear signing form: its inputs have the labels and formats of an ERC-7730 descriptor"
          >
            Clear Signing
          </span>
        )}
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
            {/* The card's border holds the content, so it starts at the name's left edge */}
            <div className="px-3 pb-4 sm:px-4">
              <FunctionDocsContext.Provider value={docsOpen}>
                <div className="max-w-2xl">
                  {/* One line: the selector at the left; the form switch and the docs link at the right */}
                  {(fn.selector || hasDocs || clear) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {fn.selector && <SelectorChip fn={fn} onGrey />}
                      <span className="ml-auto inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                        {clear && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={wantedForm === "clear"}
                            onClick={() => setWantedForm(wantedForm === "clear" ? "abi" : "clear")}
                            data-tooltip-id="global-tooltip"
                            data-tooltip-content={
                              wantedForm === "clear"
                                ? "On: the inputs have the labels and formats of the contract's ERC-7730 descriptor. Both forms edit the same values"
                                : "Off: the inputs have the names and types of the verified ABI. Both forms edit the same values"
                            }
                            className="inline-flex cursor-pointer items-center gap-2 rounded text-sm text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 focus-visible:ring-offset-2"
                          >
                            Clear signing
                            <span
                              className={`relative inline-block h-4 w-7 rounded-full transition-colors ${wantedForm === "clear" ? "bg-green-600" : "bg-gray-300"}`}
                              aria-hidden="true"
                            >
                              <span
                                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-[left] ${wantedForm === "clear" ? "left-3.5" : "left-0.5"}`}
                              />
                            </span>
                          </button>
                        )}
                        {hasDocs && (
                          <button
                            type="button"
                            aria-expanded={docsOpen}
                            onClick={() => setDocsOpen(!docsOpen)}
                            className={buttonQuiet}
                          >
                            <IoBookOutline className="h-3.5 w-3.5" />
                            {docsOpen ? "Hide Docs" : "Show Docs"}
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                  <FunctionDetails fn={fn} showSelector={false} />
                </div>
                <FunctionPanel
                  fn={fn}
                  ctx={ctx}
                  autoRead={autoRead}
                  clear={clear}
                  wantedForm={wantedForm}
                  onFormChange={setWantedForm}
                />
              </FunctionDocsContext.Provider>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
