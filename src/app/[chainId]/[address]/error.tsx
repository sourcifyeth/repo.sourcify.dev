"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import ErrorState from "@/components/ErrorState";

/**
 * Error boundary for the contract page. It is reached when the contract data
 * could not be fetched from the Sourcify server for a reason other than "not
 * verified" (rate limited, server unreachable, malformed response...). Before
 * github issue #84 these failures were reported as "Contract not found", which
 * wrongly asserted that a verified contract wasn't. Because the page fails
 * server-side the response is a 500, so real outages show up in error rates.
 */
export default function ContractError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { chainId, address } = useParams<{ chainId: string; address: string }>();

  useEffect(() => {
    console.error("Error loading contract page:", error);
  }, [error]);

  return (
    <div>
      <div className="mt-3 mb-2">
        <h1 className="text-base break-all md:text-2xl font-bold font-mono text-gray-900">{address}</h1>
        <p className="text-sm md:text-base text-gray-700 mt-1">on chain {chainId}</p>
      </div>
      <ErrorState
        message="Couldn't load the contract from the Sourcify server."
        secondaryMessage="This is a temporary problem on our side and says nothing about whether the contract is verified. Please try again in a moment."
      >
        <button onClick={reset} className="mt-2 underline hover:text-red-900 font-medium cursor-pointer">
          Try again
        </button>
      </ErrorState>
    </div>
  );
}
