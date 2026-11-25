"use client";

import Link from "next/link";
import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import { shortHex } from "@/utils/interact/abi";
import type { FunctionSet } from "./useContractFunctions";
import { linkClass } from "./ui";

const HEURISTIC_TOOLTIP = [
  "Sourcify finds the implementation with known proxy patterns: it reads a storage slot of the contract, ",
  "or calls a function such as <code>implementation()</code>.<br/><br/>",
  "Sourcify does not check that the contract really sends its calls to this address. ",
  "The contract controls these values. See the Proxy section of this page.",
].join("");

/**
 * One line about the ABI that the list shows, for a proxy. Calls always go to the proxy address.
 * Returns null for a contract that is not a proxy.
 */
export function ProxyNote({ set }: { set: FunctionSet }) {
  if (!set.isProxy) return null;
  const implementation = set.ctx.implementation;

  if (set.implementation.status === "loading")
    return <p className="text-sm leading-5 text-gray-600">Loading the functions of the implementation…</p>;

  if (implementation && set.implementation.status === "failed")
    return (
      <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm leading-5 text-yellow-900">
        The functions of the implementation could not be loaded. Only the {set.counts.own} functions of the proxy itself
        are shown. Reload the page to try again.
      </p>
    );

  if (!implementation || !set.implementationVerified)
    return (
      <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm leading-5 text-yellow-900">
        {implementation ? (
          <>
            The implementation <span className="font-mono">{shortHex(implementation.address)}</span> is not verified on
            Sourcify, so only the {set.counts.own} {set.counts.own === 1 ? "function" : "functions"} of the proxy itself
            are shown.{" "}
            <a href="https://verify.sourcify.dev" target="_blank" rel="noopener noreferrer" className="underline">
              Verify it
            </a>
          </>
        ) : (
          <>Sourcify found no implementation for this proxy. Only the functions of the proxy itself are shown.</>
        )}
      </p>
    );

  return (
    <p className="line-clamp-2 text-sm leading-5 text-gray-600 sm:line-clamp-none">
      {set.source === "implementation" ? (
        <>
          ABI of the implementation{" "}
          <Link href={`/${set.ctx.chainId}/${implementation.address}`} className={linkClass}>
            {implementation.name} <span className="font-mono">{shortHex(implementation.address)}</span>
          </Link>
          . Calls go to this proxy.
          {set.heuristic && (
            <>
              {" "}
              Found by heuristics
              <InfoTooltip content={HEURISTIC_TOOLTIP} html={true} className="ml-1 align-middle" />
            </>
          )}
        </>
      ) : (
        <>The functions of the proxy contract itself, such as upgrade functions. Reads use the proxy admin as sender.</>
      )}
      {set.implementationCount > 1 && set.source === "implementation" && (
        <>
          {" "}
          This proxy has {set.implementationCount} implementations (for example the facets of a diamond). Only the
          functions of the first one are shown.
        </>
      )}
    </p>
  );
}

/** Opens and closes rows. A row that was open once stays mounted, so its inputs survive a close. */
export function useOpenRows() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState<Set<string>>(new Set());
  const toggle = (ids: string[], shouldOpen: boolean) => {
    setOpen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (shouldOpen) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    if (shouldOpen) setMounted((current) => new Set([...current, ...ids]));
  };
  const reset = () => {
    setOpen(new Set());
    setMounted(new Set());
  };
  return { open, mounted, toggle, reset };
}

/** Scrolls a sideways-scrolling tab line so that its selected tab is fully visible. Moves only the line, not the page. */
export function keepSelectedTabInView(list: HTMLElement | null) {
  const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
  const left = tab.offsetLeft - list.offsetLeft;
  if (left < list.scrollLeft) list.scrollLeft = left - 8;
  else if (left + tab.offsetWidth > list.scrollLeft + list.clientWidth * 0.85)
    list.scrollLeft = left + tab.offsetWidth - list.clientWidth * 0.85 + 8;
}
