"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ErrorState from "@/components/ErrorState";

const SIMILARITY_DOCS_URL = "https://docs.sourcify.dev/docs/similarity-verification/";
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;

interface SimilarityVerificationProps {
  chainId: string;
  address: string;
  serverUrl: string;
}

/**
 * Shown when a contract is not verified. Triggers a similarity verification job
 * on the Sourcify server and polls it until it completes. On success the page is
 * refreshed to show the now-verified contract, otherwise an error state is shown.
 */
export default function SimilarityVerification({ chainId, address, serverUrl }: SimilarityVerificationProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "failed">("verifying");
  // Guards against the duplicated effect invocation of React Strict Mode so we
  // only trigger one verification job per page view
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const deadline = Date.now() + TIMEOUT_MS;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // Polls the verification job until it completes. Returns true if the contract got verified.
    async function pollJob(verificationId: string): Promise<boolean> {
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const response = await fetch(`${serverUrl}/v2/verify/${verificationId}`);
          if (!response.ok) continue;
          const job = await response.json();
          if (job.isJobCompleted) {
            // already_verified: the contract got verified while the job was queued
            return !!job.contract?.match || job.error?.customCode === "already_verified";
          }
        } catch (error) {
          console.error("Error polling verification job:", error);
        }
      }
      return false;
    }

    // Used when the server responds that a verification is already running for this
    // contract (429). We can't know the job id, so poll the contract itself instead.
    async function pollContract(): Promise<boolean> {
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const response = await fetch(`${serverUrl}/v2/contract/${chainId}/${address.toLowerCase()}`);
          if (!response.ok) continue;
          const contract = await response.json();
          if (contract.match) return true;
        } catch (error) {
          console.error("Error polling contract:", error);
        }
      }
      return false;
    }

    async function verify() {
      try {
        const response = await fetch(`${serverUrl}/v2/verify/similarity/${chainId}/${address}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        let verified: boolean;
        if (response.status === 202) {
          const { verificationId } = await response.json();
          verified = await pollJob(verificationId);
        } else if (response.status === 409) {
          // already_verified: the contract got verified between the page load and this request
          verified = true;
        } else if (response.status === 429) {
          // duplicate_verification_request: a verification job is already running for this contract
          verified = await pollContract();
        } else {
          // e.g. 400 unsupported_chain or bytecode_too_short_for_similarity
          verified = false;
        }

        if (verified) {
          router.refresh();
        } else {
          setStatus("failed");
        }
      } catch (error) {
        console.error("Error triggering similarity verification:", error);
        setStatus("failed");
      }
    }

    verify();
  }, [chainId, address, serverUrl, router]);

  if (status === "failed") {
    return (
      <ErrorState
        message="Contract not found"
        secondaryMessage="Similarity verification couldn't verify this contract."
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="mt-4 text-gray-600 text-center px-4">
        This contract is not verified on Sourcify. Verifying it with{" "}
        <a
          href={SIMILARITY_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline hover:text-blue-700"
        >
          similarity search
        </a>
        ...
      </p>
    </div>
  );
}
