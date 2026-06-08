"use client";

import { useEffect, useState } from "react";

// `isStaging` is determined on the server from SOURCIFY_SERVER_URL (see layout.tsx)
// since that env var is not exposed to the client.
export default function StagingBanner({ isStaging }: { isStaging: boolean }) {
  // Set on the client only to avoid an SSR hydration mismatch.
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  if (!isStaging) {
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
