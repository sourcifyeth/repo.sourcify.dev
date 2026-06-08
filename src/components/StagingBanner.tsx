"use client";

import { useEffect, useState } from "react";

// On Netlify this app is SSR'd through functions where NODE_ENV is always
// "production", so we can't distinguish staging from production via build/runtime
// env vars. The hostname is the only reliable signal, so detect it on the client:
// show the banner everywhere except the known production host(s).
const PRODUCTION_HOSTS = ["repo.sourcify.dev"];

export default function StagingBanner() {
  // Computed on the client only to avoid an SSR hydration mismatch.
  const [url, setUrl] = useState<string | null>(null);
  const [isStaging, setIsStaging] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setIsStaging(!PRODUCTION_HOSTS.includes(window.location.hostname));
  }, []);

  if (!isStaging || url === null) {
    return null;
  }

  return (
    <div className="w-full bg-cerulean-blue-500 text-white text-center font-medium py-3 px-4">
      🚧 You are on the <span className="font-bold">staging/dev</span> environment{" "}
      <span className="mx-1 text-xl align-middle">—</span>{" "}
      <span className="font-mono font-normal">{url}</span>
    </div>
  );
}
