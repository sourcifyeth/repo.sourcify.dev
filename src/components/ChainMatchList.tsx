"use client";

import { useState, type RefObject } from "react";
import Link, { useLinkStatus } from "next/link";
import { IoCheckmarkCircle, IoCheckmarkDoneCircle, IoChevronForward } from "react-icons/io5";
import { ChainMatch } from "@/utils/allChains";
import { moveFocusInList } from "@/utils/listKeyboard";

// Show the filter input only when the list is long enough to need it
const FILTER_THRESHOLD = 8;

interface ChainMatchListProps {
  matches: ChainMatch[];
  listRef?: RefObject<HTMLUListElement | null>;
  /** Called when the user opens one of the rows */
  onSelect?: (match: ChainMatch) => void;
}

export function MatchBadge({ match }: { match: ChainMatch["contract"]["match"] }) {
  const isExact = match === "exact_match";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-green-100 text-green-800 border-green-200"
    >
      {isExact ? <IoCheckmarkDoneCircle className="w-4 h-4" /> : <IoCheckmarkCircle className="w-4 h-4" />}
      {isExact ? (
        <>
          Exact<span className="hidden sm:inline"> Match</span>
        </>
      ) : (
        "Match"
      )}
    </span>
  );
}

// Must render inside a <Link>: shows a spinner while that link's navigation is pending
function RowStatusIcon() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      aria-label="Loading"
      className="shrink-0 h-4 w-4 animate-spin rounded-full border-2 border-cerulean-blue-200 border-t-cerulean-blue-600"
    />
  ) : (
    <IoChevronForward className="shrink-0 w-4 h-4 text-gray-400" />
  );
}

export function NotVerifiedMessage() {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 text-left text-sm text-gray-700">
      <p className="font-medium">This address is not verified on Sourcify on any chain.</p>
      <a
        href="https://verify.sourcify.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-cerulean-blue-600 hover:underline"
      >
        Verify it on verify.sourcify.dev →
      </a>
    </div>
  );
}

export default function ChainMatchList({ matches, listRef, onSelect }: ChainMatchListProps) {
  const [filter, setFilter] = useState("");

  if (matches.length === 0) return <NotVerifiedMessage />;

  const query = filter.trim().toLowerCase();
  const visible = query
    ? matches.filter(
        ({ contract, chain }) => contract.chainId.includes(query) || chain?.name.toLowerCase().includes(query)
      )
    : matches;

  return (
    <div className="text-left">
      <div className="flex items-center justify-between gap-3 mb-2 min-h-9">
        {matches.length > FILTER_THRESHOLD && (
          <input
            type="text"
            aria-label="Filter chains"
            placeholder="Filter chains…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-w-0 flex-1 sm:flex-none sm:w-56 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cerulean-blue-500"
          />
        )}
        <p className="ml-auto shrink-0 whitespace-nowrap text-sm text-gray-700">
          Verified on <span className="font-semibold">{matches.length}</span>{" "}
          {matches.length === 1 ? "chain" : "chains"}
        </p>
      </div>
      <ul
        ref={listRef}
        onKeyDown={moveFocusInList}
        className="scrollbar-visible max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100"
      >
        {visible.map((match) => {
          const { contract, chain } = match;
          const deprecated = chain ? !chain.supported : false;
          return (
            <li key={`${contract.chainId}-${contract.matchId}`}>
              <Link
                href={`/${contract.chainId}/${contract.address}`}
                onClick={() => onSelect?.(match)}
                className="flex items-center gap-2 sm:gap-3 px-3 py-2 hover:bg-cerulean-blue-100 focus:bg-cerulean-blue-100 focus:outline-none"
              >
                <div className={`flex-1 min-w-0 ${deprecated ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 break-words">
                      {chain?.name ?? `Chain ${contract.chainId}`}
                    </span>
                    {deprecated && (
                      <span
                        className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600"
                        data-tooltip-id="global-tooltip"
                        data-tooltip-content="Sourcify no longer supports verification on this chain"
                      >
                        deprecated
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Chain ID: <span className="font-mono">{contract.chainId}</span>
                  </div>
                </div>
                <div className={`shrink-0 ${deprecated ? "opacity-50" : ""}`}>
                  <MatchBadge match={contract.match} />
                </div>
                <RowStatusIcon />
              </Link>
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-3 py-2.5 text-sm text-gray-500">No chains match “{filter}”.</li>}
      </ul>
    </div>
  );
}
