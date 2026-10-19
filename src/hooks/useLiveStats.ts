"use client";

import { useEffect, useRef, useState } from "react";
import { LiveItem, mergeLiveItems, parseLiveEvent } from "@/utils/liveStats";

// If no event arrives in this time, show the feed as unavailable. EventSource keeps retrying,
// so a later event still switches the feed to live.
const FIRST_EVENT_TIMEOUT_MS = 10_000;

export type LiveStatus =
  | "connecting" // no event yet
  | "live" // the stream is open and has sent data
  | "reconnecting" // the stream dropped after it sent data; EventSource retries by itself
  | "unavailable"; // the stream never sent data and closed (e.g. 404 where the stream is not deployed)

export type LiveStats = {
  /** Latest live total, or null if no live event has arrived yet. */
  total: number | null;
  /** Newest first, at most MAX_FEED_ITEMS. */
  items: LiveItem[];
  status: LiveStatus;
};

function useIsPageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * Subscribes to the live verified-contracts stream (Server-Sent Events) while the browser tab is visible.
 * Closes the connection when the tab is hidden and reconnects when it is visible again.
 * Ported from sourcify-ui (src/pages/LandingPage/useLiveStats.ts).
 */
export default function useLiveStats(url: string): LiveStats {
  const isPageVisible = useIsPageVisible();
  const [total, setTotal] = useState<number | null>(null);
  const [items, setItems] = useState<LiveItem[]>([]);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const hasReceivedRef = useRef(false);

  useEffect(() => {
    if (!isPageVisible || typeof EventSource === "undefined") return;

    let source: EventSource;
    try {
      source = new EventSource(url);
    } catch {
      setStatus("unavailable");
      return;
    }

    // After a reconnect the server may send nothing until the next match, so the open stream alone counts as live.
    source.onopen = () => {
      if (hasReceivedRef.current) setStatus("live");
    };

    source.onmessage = (event: MessageEvent<string>) => {
      const parsed = parseLiveEvent(event.data);
      if (!parsed) return;
      hasReceivedRef.current = true;
      setStatus("live");
      setTotal(parsed.total);
      setItems((prev) => mergeLiveItems(prev, parsed.items));
    };

    // EventSource reconnects by itself after most errors. It closes for good on an HTTP error such as 404.
    source.onerror = () => {
      if (hasReceivedRef.current) setStatus("reconnecting");
      else if (source.readyState === EventSource.CLOSED) setStatus("unavailable");
    };

    // A retryable error (5xx, network) before the first event leaves readyState at CONNECTING,
    // so onerror alone would keep the placeholder rows forever
    const timeout = setTimeout(() => {
      if (!hasReceivedRef.current) setStatus("unavailable");
    }, FIRST_EVENT_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
      source.close();
    };
  }, [url, isPageVisible]);

  return { total, items, status };
}
