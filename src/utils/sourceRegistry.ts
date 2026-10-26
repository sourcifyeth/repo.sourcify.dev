import { useSyncExternalStore } from "react";

/**
 * The source files of the contract on the page, shared between the source
 * view (which registers them) and the bytecode sections (which read them to
 * show "file:line" for each instruction). The page already sends the sources
 * to the source view; this store avoids sending them a second time to the
 * bytecode sections.
 */
type Sources = Record<string, { content: string }>;

let current: Sources | null = null;
const listeners = new Set<() => void>();

export function registerSources(sources: Sources): () => void {
  current = sources;
  listeners.forEach((listener) => listener());
  return () => {
    if (current === sources) {
      current = null;
      listeners.forEach((listener) => listener());
    }
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The registered sources, or null before the source view has loaded. */
export function useRegisteredSources(): Sources | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}

/**
 * The source maps of the bytecode sections ("runtime", "creation"), shared
 * the other way: each bytecode section gets its source map from the page and
 * registers it here, and "Show in Bytecode" in the source view reads it. So
 * the page sends each source map only once.
 */
const sourceMaps = new Map<string, string>();

export function registerSourceMap(id: string, sourceMap: string | undefined): () => void {
  if (!sourceMap) return () => {};
  sourceMaps.set(id, sourceMap);
  return () => {
    if (sourceMaps.get(id) === sourceMap) sourceMaps.delete(id);
  };
}

/** The registered source map of a bytecode section, if it has one. */
export function registeredSourceMap(id: "runtime" | "creation"): string | undefined {
  return sourceMaps.get(id);
}

/**
 * The event that "Show in Bytecode" sends to the bytecode sections: a byte
 * range in one source file. `target` names the section that scrolls into view.
 */
export const SHOW_IN_BYTECODE_EVENT = "sourcify:show-in-bytecode";

export interface ShowInBytecodeDetail {
  path: string;
  startByte: number;
  endByte: number;
  // For example "SeaDrop.sol lines 187–190"
  label: string;
  target: "runtime" | "creation" | null;
}
