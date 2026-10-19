"use client";

import { useMemo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { IoArrowForward } from "react-icons/io5";
import { ChainData } from "@/types/chain";
import OptionDropdown from "./OptionDropdown";

export const SIMILARITY_DOCS_URL = "https://docs.sourcify.dev/docs/similarity-verification/";

interface SimilarityPromptProps {
  address: string;
  chains: ChainData[];
  /** Chains where the address is already verified. They are left out of the picker. */
  excludeChainIds?: string[];
}

// Must render inside a <Link>: shows a spinner while the contract page loads
function ButtonIcon() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      aria-label="Loading"
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  ) : (
    <IoArrowForward className="w-4 h-4" />
  );
}

/**
 * A chain picker and a button that opens the contract page on that chain.
 * The contract page starts a similarity verification when the contract is not verified there.
 */
export default function SimilarityPrompt({ address, chains, excludeChainIds = [] }: SimilarityPromptProps) {
  const options = useMemo(
    () =>
      chains
        .filter((chain) => chain.supported && !excludeChainIds.includes(chain.chainId.toString()))
        .map((chain) => ({ value: chain.chainId.toString(), label: chain.name, detail: `Chain ID: ${chain.chainId}` })),
    [chains, excludeChainIds]
  );
  const [chainId, setChainId] = useState(() => options.find((o) => o.value === "1")?.value ?? options[0]?.value ?? "");

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="min-w-0 flex-1">
        <OptionDropdown
          ariaLabel="Chain for similarity verification"
          options={options}
          value={chainId}
          onChange={setChainId}
        />
      </div>
      <Link
        href={`/${chainId}/${address}`}
        className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-cerulean-blue hover:bg-cerulean-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cerulean-blue-500"
      >
        Try similarity
        <ButtonIcon />
      </Link>
    </div>
  );
}
