"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { IoCheckmarkCircle, IoChevronDown, IoServerOutline, IoWarning } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import { groupDigits, shortHex } from "@/utils/interact/abi";
import { type ChainRpcs, type Tracking, isAllowedRpcUrl } from "@/utils/interact/chainRpcs";
import type { RpcEndpoint, SourceResult } from "@/utils/interact/types";
import { jsonRpc } from "@/utils/interact/rpcRead";
import { buttonQuiet, buttonSecondary, buttonSmall, inputBorder, inputClass } from "./ui";

/* ------------------------------------------------------------------ state */

interface SourcesContextValue {
  /** "loading" until the list of public RPC endpoints has arrived from /api/chain-rpcs */
  status: "loading" | "ready" | "failed";
  /** The Chainlist data of the chain: name, currency, explorers (for "add chain" and explorer links) */
  chain: ChainRpcs | null;
  /** Every endpoint that the user can pick for this chain */
  available: RpcEndpoint[];
  /** The endpoints that a read call asks: two if possible */
  selected: RpcEndpoint[];
  toggle: (id: string) => void;
  setCustom: (url: string | null) => void;
  /** Swaps one selected endpoint for the next one that is not selected and has not failed. Returns the new selection, or null if there is no other endpoint. */
  replace: (id: string) => RpcEndpoint[] | null;
  /**
   * Marks endpoints as failed for this visit and swaps them for working ones. Returns the new selection,
   * or null if no other endpoint is left.
   */
  replaceFailed: (ids: string[]) => RpcEndpoint[] | null;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the "Read data sources" control and scrolls to it */
  show: () => void;
  controlRef: React.RefObject<HTMLDivElement | null>;
}

const SourcesContext = createContext<SourcesContextValue | null>(null);

export function useSources(): SourcesContextValue {
  const value = useContext(SourcesContext);
  if (!value) throw new Error("useSources needs a SourcesProvider");
  return value;
}

const CUSTOM_ID = "custom";
/** The user's choice of endpoints, per chain, in this browser only */
const storageKey = (chainId: string) => `sourcify-interact-rpcs-${chainId}`;

function loadChoice(chainId: string): { picked: string[] | null; customUrl: string | null } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(chainId)) ?? "null");
    if (saved && Array.isArray(saved.picked))
      return {
        picked: saved.picked.filter((id: unknown) => typeof id === "string"),
        customUrl: saved.customUrl ?? null,
      };
  } catch {
    // No storage (private window, blocked) or a broken entry: use the defaults
  }
  return { picked: null, customUrl: null };
}

function saveChoice(chainId: string, picked: string[] | null, customUrl: string | null) {
  try {
    if (picked === null && customUrl === null) window.localStorage.removeItem(storageKey(chainId));
    else window.localStorage.setItem(storageKey(chainId), JSON.stringify({ picked, customUrl }));
  } catch {
    // The choice then lasts only for this visit
  }
}

/**
 * Holds the choice of RPC endpoints for the whole section (not per function). Loads the public endpoints
 * of the chain from /api/chain-rpcs when the section opens; that request goes only to this site.
 */
export function SourcesProvider({ chainId, children }: { chainId: string; children: React.ReactNode }) {
  const [chain, setChain] = useState<ChainRpcs | null>(null);
  const [status, setStatus] = useState<SourcesContextValue["status"]>("loading");
  // null: the defaults of the list (the best two endpoints from different providers)
  const [picked, setPicked] = useState<string[] | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  // Endpoints that failed in this visit: never picked again by "Try another RPC" or by the automatic swap
  const failed = useRef<Set<string>>(new Set());
  const controlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const saved = loadChoice(chainId);
    setPicked(saved.picked);
    setCustomUrl(saved.customUrl);
    fetch(`/api/chain-rpcs/${chainId}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<ChainRpcs>;
      })
      .then((data) => {
        if (cancelled) return;
        setChain(data);
        setStatus("ready");
      })
      .catch((error) => {
        console.error("Could not load the public RPC endpoints:", error);
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  const available = useMemo(() => {
    const list: RpcEndpoint[] = (chain?.rpcs ?? []).map((rpc) => ({
      id: rpc.url,
      host: rpc.host,
      url: rpc.url,
      tracking: rpc.tracking,
      kind: "public",
    }));
    if (customUrl) {
      let host = customUrl;
      try {
        host = new URL(customUrl).host;
      } catch {
        // Keep the text as the name
      }
      // The user's own URL goes first, so it is easy to see and to clear
      list.unshift({ id: CUSTOM_ID, host, url: customUrl, tracking: "unknown", kind: "custom" });
    }
    return list;
  }, [chain, customUrl]);

  const selected = useMemo(() => {
    const ids = picked ?? chain?.defaults ?? [];
    return ids.flatMap((id) => available.find((endpoint) => endpoint.id === id) ?? []).slice(0, 2);
  }, [picked, chain, available]);

  const choose = useCallback(
    (ids: string[], custom: string | null) => {
      setPicked(ids);
      setCustomUrl(custom);
      saveChoice(chainId, ids, custom);
    },
    [chainId]
  );

  const toggle = useCallback(
    (id: string) => {
      const ids = selected.map((endpoint) => endpoint.id);
      choose(ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id].slice(0, 2), customUrl);
    },
    [selected, choose, customUrl]
  );

  const setCustom = useCallback(
    (url: string | null) => {
      const ids = selected.map((endpoint) => endpoint.id).filter((id) => id !== CUSTOM_ID);
      // The custom endpoint takes the place of the second endpoint
      choose(url ? [...ids.slice(0, 1), CUSTOM_ID] : ids, url);
    },
    [selected, choose]
  );

  /** The next public endpoint that is not in `taken`, has not failed in this visit, and is not down. */
  const nextCandidate = useCallback(
    (taken: Set<string>) =>
      available.find(
        (endpoint) =>
          endpoint.kind === "public" &&
          !taken.has(endpoint.id) &&
          !failed.current.has(endpoint.id) &&
          chain?.rpcs.find((rpc) => rpc.url === endpoint.url)?.health !== "down"
      ) ?? null,
    [available, chain]
  );

  const replaceFailed = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => failed.current.add(id));
      const taken = new Set(selected.map((endpoint) => endpoint.id));
      let changed = false;
      const result = selected.map((endpoint) => {
        if (!ids.includes(endpoint.id)) return endpoint;
        const next = nextCandidate(taken);
        if (!next) return endpoint;
        taken.add(next.id);
        changed = true;
        return next;
      });
      if (!changed) return null;
      choose(
        result.map((endpoint) => endpoint.id),
        customUrl
      );
      return result;
    },
    [selected, nextCandidate, choose, customUrl]
  );

  const replace = useCallback((id: string) => replaceFailed([id]), [replaceFailed]);

  const show = useCallback(() => {
    setOpen(true);
    controlRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  const value = useMemo(
    () => ({
      status,
      chain,
      available,
      selected,
      toggle,
      setCustom,
      replace,
      replaceFailed,
      isOpen,
      setOpen,
      show,
      controlRef,
    }),
    [status, chain, available, selected, toggle, setCustom, replace, replaceFailed, isOpen, show]
  );
  return <SourcesContext.Provider value={value}>{children}</SourcesContext.Provider>;
}

/* ------------------------------------------------------- the picker control */

const TRACKING_STYLE: Record<Tracking, string> = {
  none: "border-green-200 bg-green-50 text-green-800",
  limited: "border-yellow-200 bg-yellow-50 text-yellow-800",
  yes: "border-red-200 bg-red-50 text-red-800",
  unknown: "border-gray-200 bg-gray-100 text-gray-600",
};

function TrackingLabel({ tracking }: { tracking: Tracking }) {
  return (
    <span
      className={`inline-flex shrink-0 cursor-help items-center rounded border px-1.5 text-xs leading-[18px] ${TRACKING_STYLE[tracking]}`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content="How much this provider tracks its users (IP address, wallet address), as Chainlist labels it"
    >
      tracking: {tracking}
    </span>
  );
}

/**
 * "Read data sources": which RPC endpoints the read calls go to. One control for
 * the whole section. Closed, it is one line with the two host names.
 */
export function DataSources({ compact = false }: { compact?: boolean }) {
  const { status, chain, available, selected, toggle, setCustom, isOpen, setOpen, controlRef } = useSources();
  const chainId = String(chain?.chainId ?? "");
  const panelId = useId();
  const customId = useId();
  const [customText, setCustomText] = useState("");
  const [checking, setChecking] = useState(false);
  const [customProblem, setCustomProblem] = useState<string | null>(null);
  const customError = customText !== "" && !isAllowedRpcUrl(customText.trim());
  const hasCustom = available.some((endpoint) => endpoint.kind === "custom");
  const publicCount = available.filter((endpoint) => endpoint.kind === "public").length;

  // The compact control is a popover: a click outside or Escape closes it
  useEffect(() => {
    if (!compact || !isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [compact, isOpen, setOpen, controlRef]);

  const panel = (
    <div id={panelId} className={compact ? "space-y-3" : "mt-2 max-w-2xl space-y-3 pb-1"}>
      <p className="text-sm text-gray-600">
        Read calls go from your browser directly to these providers, not through Sourcify. Choose two: each read asks
        both and compares the answers. The list comes from{" "}
        <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer" className="underline">
          Chainlist
        </a>
        .
      </p>

      {status === "loading" && <p className="text-sm text-gray-500">Loading the list of public RPC endpoints…</p>}
      {status === "failed" && (
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          The list of public RPC endpoints could not be loaded. Enter a custom RPC URL, or reload the page later.
        </p>
      )}
      {status === "ready" && publicCount === 0 && (
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          Chainlist has no public RPC endpoint for this chain. To read, enter a custom RPC URL.
        </p>
      )}
      {status === "ready" && publicCount === 1 && (
        <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          Chainlist has only one public RPC endpoint for this chain. Add a custom URL to cross-check the answers.
        </p>
      )}

      <ul className="scrollbar-visible max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
        {available.map((endpoint) => {
          const checked = selected.some((other) => other.id === endpoint.id);
          const blocked = !checked && selected.length >= 2;
          return (
            <li key={endpoint.id}>
              <label
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 ${blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-50"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={blocked}
                  onChange={() => toggle(endpoint.id)}
                  className="h-4 w-4 accent-cerulean-blue-500"
                />
                <span className="min-w-0 break-all font-mono text-[13px] text-gray-900" title={endpoint.url}>
                  {endpoint.host}
                </span>
                {endpoint.kind === "custom" && (
                  <span
                    className="inline-flex shrink-0 items-center rounded border border-cerulean-blue-200 bg-cerulean-blue-100 px-1.5 text-xs leading-[18px] text-cerulean-blue-700"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content="An RPC URL that you entered. It is kept in this browser for this chain."
                  >
                    Custom
                  </span>
                )}
                {chain?.rpcs.find((rpc) => rpc.url === endpoint.url)?.health === "down" && (
                  <span
                    className="cursor-help text-xs text-red-700"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content="Did not answer the server's check: no answer, wrong chain, or no browser access (CORS)"
                  >
                    not answering
                  </span>
                )}
                <span className="ml-auto">
                  <TrackingLabel tracking={endpoint.tracking} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {selected.length >= 2 && available.length > 2 && (
        <p className="text-sm text-gray-500">Two sources are selected. Clear one to choose another.</p>
      )}

      <div>
        <label htmlFor={customId} className="mb-1 block text-sm font-medium text-gray-700">
          Custom RPC URL
        </label>
        <div className="flex gap-2">
          <input
            id={customId}
            type="url"
            value={customText}
            placeholder="https://…"
            aria-invalid={customError}
            onChange={(e) => setCustomText(e.target.value)}
            className={`${inputClass} ${inputBorder(customError)}`}
          />
          <button
            type="button"
            className={`${buttonSecondary} shrink-0`}
            disabled={customText === "" || customError}
            onClick={async () => {
              // The user asked for this URL: check that it is an RPC for this chain before using it
              const url = customText.trim();
              setChecking(true);
              setCustomProblem(null);
              try {
                const hex = await jsonRpc<string>(url, "eth_chainId", [], { timeoutMs: 6000 });
                const answered = Number.parseInt(hex, 16);
                if (answered !== Number(chainId)) {
                  setCustomProblem(`This RPC is for chain ${answered}, not for chain ${chainId}. It was not added.`);
                  return;
                }
                setCustom(url);
                setCustomText("");
              } catch (error) {
                setCustomProblem(
                  `This URL did not answer as an RPC: ${error instanceof Error ? error.message : String(error)}. It was not added.`
                );
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Use"}
          </button>
          {hasCustom && (
            <button type="button" className={buttonQuiet} onClick={() => setCustom(null)}>
              Remove
            </button>
          )}
        </div>
        {customError && (
          <p className="mt-1 text-sm text-red-700">
            Enter a URL that starts with https://, or http://localhost or http://127.0.0.1 for a node on this computer.
          </p>
        )}
        {customProblem && <p className="mt-1 text-sm text-red-700">{customProblem}</p>}
      </div>
    </div>
  );

  if (compact) {
    const state = selected.length >= 2 ? "ok" : selected.length === 1 ? "single" : "none";
    return (
      <div ref={controlRef} className="relative">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpen(!isOpen)}
          className={`${buttonSecondary} max-w-full gap-2`}
          data-tooltip-id={isOpen ? undefined : "global-tooltip"}
          data-tooltip-content={
            selected.length ? `Reads ask: ${selected.map((endpoint) => endpoint.host).join(" and ")}` : undefined
          }
        >
          <IoServerOutline className="h-4 w-4 text-gray-500" />
          <span className="hidden sm:inline">Read data sources</span>
          <span
            className={`rounded px-1.5 text-xs leading-5 ${status === "loading" ? "bg-gray-100 text-gray-600" : state === "ok" ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-900"}`}
          >
            {status === "loading" ? "…" : state === "ok" ? "2 RPCs" : state === "single" ? "1 RPC" : "none"}
          </span>
          <IoChevronDown className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-[min(30rem,calc(100vw-5.5rem))] sm:left-auto sm:right-0 sm:w-[min(30rem,calc(100vw-2.5rem))] rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg">
            <p className="mb-2 font-medium text-gray-900">Read data sources</p>
            {panel}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={controlRef} className="border-b border-gray-200 px-4 py-2 text-sm">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpen(!isOpen)}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
      >
        <IoServerOutline className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="font-medium text-gray-800">Read data sources</span>
        {selected.length === 0 ? (
          <span className="rounded border border-yellow-200 bg-yellow-50 px-1.5 text-xs leading-5 text-yellow-900">
            none: read calls are not possible
          </span>
        ) : (
          selected.map((endpoint) => (
            <span key={endpoint.id} className="min-w-0 truncate font-mono text-xs text-gray-600">
              {endpoint.host}
            </span>
          ))
        )}
        {selected.length === 1 && (
          <span className="text-xs text-yellow-800">1 source: answers are not cross-checked</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-cerulean-blue-600">
          Change <IoChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>
      {isOpen && panel}
    </div>
  );
}

/* -------------------------------------------------- provenance of a result */

function SourceDetails({ sources }: { sources: SourceResult[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {sources.map((source) => (
        <li key={source.endpoint.id} className="rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`h-2 w-2 shrink-0 rounded-full ${source.ok ? "bg-green-500" : "bg-red-500"}`} />
            <span className="min-w-0 break-all font-mono text-gray-900">{source.endpoint.url}</span>
            <TrackingLabel tracking={source.endpoint.tracking} />
            <span className="ml-auto tabular-nums text-gray-500">{groupDigits(String(source.ms))} ms</span>
          </div>
          {source.ok && source.raw ? (
            <div className="mt-1 flex items-start gap-2">
              <span className="shrink-0 text-gray-500">Raw answer</span>
              <code className="max-h-16 min-w-0 flex-1 overflow-y-auto break-all font-mono text-gray-700">
                {source.raw}
              </code>
              <CopyToClipboard text={source.raw} />
            </div>
          ) : (
            <p className="mt-1 text-red-700">{source.problem}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The line under every read result: where the data came from and whether the
 * sources agree. The details (full URLs, response times, raw answers) open on a click.
 */
export function Provenance({
  check,
  sources,
  block,
  onTryAnother,
}: {
  check: "agree" | "mismatch" | "single" | "one-failed";
  sources: SourceResult[];
  block?: number;
  /** Swaps the given endpoint for another one and calls again. Not given if there is no other endpoint. */
  onTryAnother?: (endpointId: string) => void;
}) {
  const { show, available } = useSources();
  const [open, setOpen] = useState(false);
  const failedSource = sources.find((source) => !source.ok);
  const hosts = sources.filter((source) => source.ok).map((source) => source.endpoint.host);
  const canSwap = available.filter((endpoint) => endpoint.kind === "public").length > sources.length;

  return (
    <div className="border-t border-gray-200 pt-2 text-sm leading-6 text-gray-600">
      <div className="flex min-w-0 items-center gap-x-2">
        {check === "agree" && (
          <span className="inline-flex items-center gap-1 text-green-800">
            <IoCheckmarkCircle className="h-4 w-4 text-green-600" /> 2 sources agree
          </span>
        )}
        {(check === "single" || check === "one-failed") && (
          <span className="inline-flex items-center gap-1 text-yellow-900">
            <IoWarning className="h-4 w-4 text-yellow-600" /> From 1 source, not cross-checked
          </span>
        )}
        {block !== undefined && (
          <span className="shrink-0">
            · block <span className="font-mono text-[13px]">{groupDigits(String(block))}</span>
          </span>
        )}
        {hosts.length > 0 && (
          <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-gray-500 sm:inline">
            · {hosts.join(" · ")}
          </span>
        )}
        <button
          type="button"
          className={`${buttonQuiet} ml-auto shrink-0`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide details" : "Details"}
        </button>
      </div>

      {check === "one-failed" && failedSource && (
        <p className="text-yellow-900">
          <span className="font-mono text-[13px]">{failedSource.endpoint.host}</span> gave no answer:{" "}
          {failedSource.problem}.
        </p>
      )}
      {check === "single" && sources.length === 1 && (
        <p>Only one source is selected, so there is no second answer to compare with.</p>
      )}
      {(check === "one-failed" || check === "single") && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {check === "one-failed" && failedSource && canSwap && onTryAnother && (
            <button type="button" className={buttonSmall} onClick={() => onTryAnother(failedSource.endpoint.id)}>
              Try another RPC
            </button>
          )}
          <button type="button" className={buttonSmall} onClick={show}>
            {check === "single" ? "Add a second source" : "Choose data sources"}
          </button>
        </div>
      )}
      {open && <SourceDetails sources={sources} />}
    </div>
  );
}

/** Both endpoints failed, or there is no endpoint: what the user can do. */
export function SourcesFailed({ sources, onRetry }: { sources: SourceResult[]; onRetry: () => void }) {
  const { show } = useSources();
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-medium">
        {sources.length > 1 ? "Neither source answered." : "The source did not answer."} There is no result.
      </p>
      <p className="mt-1">The contract and your inputs are not the cause. The RPC providers did not respond.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {sources.map((source) => (
          <li key={source.endpoint.id} className="flex flex-wrap gap-x-2">
            <span className="font-mono">{source.endpoint.host}</span>
            <span>{source.problem}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={buttonSmall} onClick={onRetry}>
          Try again
        </button>
        <button type="button" className={buttonSmall} onClick={show}>
          Choose other RPCs
        </button>
      </div>
    </div>
  );
}

export const shortRaw = (raw: string) => shortHex(raw, 10, 8);
