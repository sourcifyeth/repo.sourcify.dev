"use client";

import { startTransition, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ErrorState from "@/components/ErrorState";

/**
 * Error boundary for the contract page. It is reached when rendering the page
 * threw on the server, most commonly because the contract data could not be
 * fetched from the Sourcify server for a reason other than "not verified"
 * (rate limited, server unreachable, malformed response...). Because the page
 * fails server-side the response is a 500, so real outages show up in error
 * rates. It must never describe the contract as "not found".
 */
export default function ContractError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { chainId, address } = useParams<{ chainId: string; address: string }>();
  const router = useRouter();

  useEffect(() => {
    console.error("Error loading contract page:", error);
  }, [error]);

  // reset() alone only re-renders the children the boundary already has, which
  // for a server error is the payload containing that error. Refresh the router
  // in the same transition so the server render (and the fetch) is retried.
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div>
      <div className="mt-3 mb-2">
        <h1 className="text-base break-all md:text-2xl font-bold font-mono text-gray-900">{address}</h1>
        <p className="text-sm md:text-base text-gray-700 mt-1">on chain {chainId}</p>
      </div>
      <ErrorState
        message="Couldn't load this contract."
        secondaryMessage="This may be a temporary problem. It says nothing about whether the contract is verified. Please try again in a moment."
      >
        <button onClick={retry} className="mt-2 underline hover:text-red-900 font-medium cursor-pointer">
          Try again
        </button>
      </ErrorState>
    </div>
  );
}
