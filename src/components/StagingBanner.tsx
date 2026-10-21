"use client";

import { useEffect, useState } from "react";

// On Netlify this app is SSR'd through functions where NODE_ENV is always
// "production", so we can't distinguish staging from production via build/runtime
// env vars. The hostname is the only reliable signal, so detect it on the client:
// show the banner everywhere except the known production host(s).
const PRODUCTION_HOSTS = ["repo.sourcify.dev"];
const TITLE_PREFIX = "(staging) ";

// Next.js sets document.title again on every client-side navigation, so watch
// the <head> and add the prefix back whenever a new title lacks it.
function prefixTitle() {
  const addPrefix = () => {
    if (!document.title.startsWith(TITLE_PREFIX)) {
      document.title = TITLE_PREFIX + document.title;
    }
  };
  addPrefix();
  const observer = new MutationObserver(addPrefix);
  observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  return () => observer.disconnect();
}

export default function StagingBanner() {
  // Computed on the client only to avoid an SSR hydration mismatch.
  const [url, setUrl] = useState<string | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  // Kept in memory only, so the banner comes back on every page load.
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setIsStaging(!PRODUCTION_HOSTS.includes(window.location.hostname));
  }, []);

  // Runs even after the banner is closed, because the component stays mounted.
  useEffect(() => {
    if (isStaging) {
      return prefixTitle();
    }
  }, [isStaging]);

  if (!isStaging || url === null || isClosed) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-cerulean-blue-500 text-white text-center font-medium py-3 pl-4 pr-12">
      🚧 You are on the <span className="font-bold">staging/dev</span> environment{" "}
      <span className="mx-1 text-xl align-middle">—</span>{" "}
      <span className="font-mono font-normal">{url}</span>
      <button
        type="button"
        onClick={() => setIsClosed(true)}
        aria-label="Close staging banner"
        title="Close"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-2 text-2xl leading-none text-white/80 hover:text-white hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}
