"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";

type Tab = "code" | "read-write";

/**
 * The two tabs of a contract: "Code" (the verification page) and "Read/Write Contract".
 * Both tabs come with the page, so a switch is instant: it changes only what is shown and the URL
 * (/<chainId>/<address> or …/read-write). The browser does not load another page.
 * The Read/Write tab is built hidden in the background once the page is idle (its code, the implementation
 * ABI and the RPC list load then), so the first switch does not wait. It reads nothing from a chain until the
 * user opens a function. Once built it stays, so its forms keep their values.
 */
export default function ContractTabs({
  chainId,
  address,
  initialTab,
  code,
  readWrite,
}: {
  chainId: string;
  address: string;
  initialTab: Tab;
  code: ReactNode;
  /** null if the contract has nothing to call */
  readWrite: ReactNode | null;
}) {
  const base = `/${chainId}/${address}`;
  const [tab, setTab] = useState<Tab>(readWrite ? initialTab : "code");
  const [readWriteOpened, setReadWriteOpened] = useState(tab === "read-write");

  const show = useCallback(
    (next: Tab, { push = true }: { push?: boolean } = {}) => {
      setTab(next);
      if (next === "read-write") setReadWriteOpened(true);
      const path = next === "read-write" ? `${base}/read-write` : base;
      if (push && window.location.pathname !== path) {
        // Keep ?fn= on the Read/Write tab; drop the hash, which belongs to the Code tab (#file=…)
        const search = next === "read-write" ? window.location.search : "";
        window.history.pushState(null, "", `${path}${search}`);
      }
    },
    [base]
  );

  // Back and forward buttons: follow the URL
  useEffect(() => {
    const onPop = () => setTab(window.location.pathname.endsWith("/read-write") && readWrite ? "read-write" : "code");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [readWrite]);

  // A link to a part of the Code tab (#proxy from the Proxy badge, #file=… for a source line) opens the Code tab
  useEffect(() => {
    const onHash = () => {
      if (tab !== "read-write" || !window.location.hash) return;
      const hash = window.location.hash;
      setTab("code");
      window.history.replaceState(null, "", `${base}${hash}`);
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [tab, base]);

  // Build the Read/Write tab in the background when the browser is idle (at the latest after 3 s)
  useEffect(() => {
    if (!readWrite || readWriteOpened) return;
    const open = () => setReadWriteOpened(true);
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(open, 1500);
      return () => window.clearTimeout(timer);
    }
    const handle = window.requestIdleCallback(open, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }, [readWrite, readWriteOpened]);

  const tabs: Array<{ id: Tab; label: string; href: string }> = [
    { id: "code", label: "Code", href: base },
    ...(readWrite ? [{ id: "read-write" as const, label: "Read/Write Contract", href: `${base}/read-write` }] : []),
  ];

  return (
    <>
      <nav aria-label="Contract views" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={tab === item.id ? "page" : undefined}
                onMouseEnter={item.id === "read-write" ? () => setReadWriteOpened(true) : undefined}
                onClick={(event) => {
                  // A new tab or window (Ctrl/Cmd/middle click) opens the URL as usual
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  show(item.id);
                }}
                className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 focus-visible:ring-offset-2 ${
                  tab === item.id
                    ? "bg-cerulean-blue-500 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div hidden={tab !== "code"}>{code}</div>
      {readWrite && readWriteOpened && <div hidden={tab !== "read-write"}>{readWrite}</div>}
    </>
  );
}
