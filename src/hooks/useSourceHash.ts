import { useCallback, useEffect, useState } from "react";
import { formatSourceHash, parseSourceHash, SourceLocation } from "@/utils/sourceHash";

interface SourceHashState {
  location: SourceLocation | null;
  // Counts the changes that came from outside the source view: the first page
  // load and `hashchange` events (a link elsewhere on the page, the back
  // button). Writes through `setLocation` do not change it. Thus the source
  // view can tell "the user clicked a line" apart from "a link asks to jump".
  external: number;
}

/**
 * Reads and writes the reader position in the URL hash (see `sourceHash.ts`).
 * Writes use `history.replaceState`. They add no history entries, fire no
 * `hashchange` event, and cause no navigation in the Next.js router.
 */
export function useSourceHash() {
  const [state, setState] = useState<SourceHashState>({ location: null, external: 0 });

  useEffect(() => {
    const read = () =>
      setState((previous) => ({ location: parseSourceHash(window.location.hash), external: previous.external + 1 }));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const setLocation = useCallback((location: SourceLocation | null) => {
    const hash = location ? formatSourceHash(location) : "";
    const url = window.location.pathname + window.location.search + hash;
    window.history.replaceState(window.history.state, "", url);
    setState((previous) => ({ ...previous, location }));
  }, []);

  return { location: state.location, external: state.external, setLocation };
}
