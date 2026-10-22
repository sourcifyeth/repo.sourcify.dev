import { useCallback, useEffect, useRef, useState } from "react";
import { extractSymbols, FileSymbols, languageOfPath } from "@/utils/sourceSymbols";
import type { SymbolsRequest, SymbolsResponse } from "@/workers/sourceSymbols.worker";

/**
 * The symbols of the source files, found on demand in a Web Worker and kept
 * for the life of the page. `version` changes when new results arrive.
 */
export function useSourceSymbols(sources: Record<string, { content: string }>) {
  const cacheRef = useRef(new Map<string, FileSymbols>());
  const waitersRef = useRef(new Map<string, Array<(result: FileSymbols) => void>>());
  const workerRef = useRef<Worker | null>(null);
  const workerFailedRef = useRef(false);
  const [version, setVersion] = useState(0);

  // Many results can arrive at once (all files for a "#" search): re-render once per frame
  const frameRef = useRef<number | null>(null);
  const bumpVersion = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setVersion((value) => value + 1);
    });
  }, []);

  const store = useCallback(
    (path: string, result: FileSymbols) => {
      cacheRef.current.set(path, result);
      const waiters = waitersRef.current.get(path) ?? [];
      waitersRef.current.delete(path);
      waiters.forEach((resolve) => resolve(result));
      bumpVersion();
    },
    [bumpVersion]
  );

  // Without a worker (old browser, or the worker failed to load), a regex scan
  // on the main thread still gives an outline
  const fallback = useCallback(
    (path: string) => {
      const content = sources[path]?.content ?? "";
      store(path, extractSymbols(content, languageOfPath(path)));
    },
    [sources, store]
  );

  const getWorker = useCallback((): Worker | null => {
    if (workerFailedRef.current) return null;
    if (workerRef.current) return workerRef.current;
    try {
      const worker = new Worker(new URL("../workers/sourceSymbols.worker.ts", import.meta.url));
      worker.onmessage = (event: MessageEvent<SymbolsResponse>) => store(event.data.path, event.data.result);
      worker.onerror = () => {
        workerFailedRef.current = true;
        worker.terminate();
        workerRef.current = null;
        [...waitersRef.current.keys()].forEach(fallback);
      };
      workerRef.current = worker;
      return worker;
    } catch {
      workerFailedRef.current = true;
      return null;
    }
  }, [store, fallback]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const send = useCallback(
    (path: string) => {
      if (cacheRef.current.has(path) || waitersRef.current.has(path) || !sources[path]) return;
      waitersRef.current.set(path, []);
      const worker = getWorker();
      if (!worker) {
        fallback(path);
        return;
      }
      const request: SymbolsRequest = { path, content: sources[path].content, language: languageOfPath(path) };
      worker.postMessage(request);
    },
    [sources, getWorker, fallback]
  );

  /** The symbols of one file, from the cache or from the worker. */
  const request = useCallback(
    (path: string): Promise<FileSymbols> => {
      const cached = cacheRef.current.get(path);
      if (cached) return Promise.resolve(cached);
      if (!sources[path]) return Promise.resolve({ symbols: [], method: "none" });
      send(path);
      return new Promise((resolve) => {
        const waiters = waitersRef.current.get(path);
        if (waiters) waiters.push(resolve);
        else resolve(cacheRef.current.get(path) ?? { symbols: [], method: "none" });
      });
    },
    [sources, send]
  );

  /** Queues many files; the worker handles them in this order. */
  const requestMany = useCallback((paths: string[]) => paths.forEach(send), [send]);

  const get = useCallback((path: string) => cacheRef.current.get(path), []);

  return { get, request, requestMany, version, indexedCount: cacheRef.current.size };
}
