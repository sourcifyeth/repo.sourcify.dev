"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoOpenOutline } from "react-icons/io5";
import useLiveStats from "@/hooks/useLiveStats";
import { formatRelativeTime, LiveItem } from "@/utils/liveStats";
import { ChainData } from "@/types/chain";
import { MatchBadge } from "./ChainMatchList";

interface LiveVerificationsProps {
  /** SSE stream of new verifications */
  streamUrl: string;
  /** Total from the daily stats.json. Shown until the live total arrives. */
  initialTotal: number | null;
  chains: ChainData[];
}

// Fixed locale, so the server and the browser render the same string
const formatNumber = (n: number) => n.toLocaleString("en-US");

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Moves the shown number to `target` with a short ease-out animation. */
function useAnimatedNumber(target: number | null, reduceMotion: boolean): number | null {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);

  useEffect(() => {
    if (target === null) return;
    const from = displayRef.current;
    const set = (value: number) => {
      displayRef.current = value;
      setDisplay(value);
    };
    if (from === null || reduceMotion) {
      set(target);
      return;
    }
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      set(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);

  return display;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-green-700" aria-label="Live updates">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}

function FeedRow({ item, chainName, now, animateIn }: { item: LiveItem; chainName: string; now: number; animateIn: boolean }) {
  // Only the value at mount counts, so a row that is already shown never animates again
  const [isNew] = useState(animateIn);
  return (
    <li data-match-id={item.matchId} className={`relative ${isNew ? "animate-feed-in" : ""}`}>
      {isNew && (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-green-500 animate-feed-edge" />
      )}
      <Link
        href={`/${item.chainId}/${item.address}`}
        className="flex items-center gap-2 px-3 py-2 hover:bg-cerulean-blue-100 focus:bg-cerulean-blue-100 focus:outline-none"
        title={`${item.address} on ${chainName}`}
      >
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{item.name ?? "Unnamed contract"}</div>
          <div className="truncate text-xs text-gray-500">
            <span className="font-mono text-cerulean-blue-600">{item.address}</span>
          </div>
          <div className="truncate text-xs text-gray-500">{chainName}</div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <MatchBadge match={item.match} />
          <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
            {formatRelativeTime(item.verifiedAt, now)}
          </span>
        </div>
      </Link>
    </li>
  );
}

const PLACEHOLDER_ROWS = 6;

export default function LiveVerifications({ streamUrl, initialTotal, chains }: LiveVerificationsProps) {
  const live = useLiveStats(streamUrl);
  const reduceMotion = usePrefersReducedMotion();
  const total = useAnimatedNumber(live.total ?? initialTotal, reduceMotion);
  const now = useNow(1000);
  const listRef = useRef<HTMLUListElement>(null);

  // Items of the first batch do not animate; only items that arrive later do
  const firstBatchIdsRef = useRef<Set<string> | null>(null);
  if (firstBatchIdsRef.current === null && live.items.length > 0) {
    firstBatchIdsRef.current = new Set(live.items.map((item) => item.matchId));
  }

  // If the user has scrolled the list, keep the rows that they see in place when new rows arrive on top
  const prevTopIdRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && list.scrollTop > 0 && prevTopIdRef.current) {
      const addedOnTop = live.items.findIndex((item) => item.matchId === prevTopIdRef.current);
      const rowHeight = list.querySelector("li")?.offsetHeight ?? 0;
      if (addedOnTop > 0) list.scrollTop += addedOnTop * (rowHeight + 1);
    }
    prevTopIdRef.current = live.items[0]?.matchId;
  }, [live.items]);

  const chainName = (chainId: string) =>
    chains.find((chain) => chain.chainId.toString() === chainId)?.name ?? `Chain ${chainId}`;

  return (
    <div className="text-left">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-2xl md:text-3xl font-semibold text-cerulean-blue-600 tabular-nums">
            {total !== null ? formatNumber(total) : "—"}
          </div>
          <div className="text-sm text-gray-600">
            verified contracts ·{" "}
            <a
              href="https://stats.sourcify.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-cerulean-blue-600 hover:underline"
            >
              stats <IoOpenOutline className="w-3 h-3" />
            </a>
          </div>
        </div>
        {live.status === "live" && <LiveDot />}
      </div>

      <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Just verified</h4>
      {live.status === "unavailable" ? (
        <p className="text-sm text-gray-500 py-4">The live feed is not available right now.</p>
      ) : (
        <ul
          ref={listRef}
          className="scrollbar-visible h-[420px] overflow-y-auto [overflow-anchor:none] rounded-md border border-gray-200 bg-white divide-y divide-gray-100"
        >
          {live.items.length === 0
            ? Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
                <li key={i} aria-hidden className="flex items-center gap-3 px-3 py-4">
                  <span className="h-2.5 w-28 rounded bg-gray-100 animate-pulse" />
                  <span className="h-2.5 w-20 rounded bg-gray-100 animate-pulse" />
                </li>
              ))
            : live.items.map((item) => (
                <FeedRow
                  key={item.matchId}
                  item={item}
                  chainName={chainName(item.chainId)}
                  now={now}
                  animateIn={!reduceMotion && !firstBatchIdsRef.current?.has(item.matchId)}
                />
              ))}
        </ul>
      )}
    </div>
  );
}
