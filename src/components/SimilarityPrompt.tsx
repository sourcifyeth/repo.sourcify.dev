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
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cerulean-blue-200 border-t-cerulean-blue-600"
    />
  ) : (
    <IoArrowForward className="w-3.5 h-3.5" />
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
          size="sm"
        />
      </div>
      <Link
        href={`/${chainId}/${address}`}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-cerulean-blue-300 bg-white text-xs font-medium text-cerulean-blue-600 hover:bg-cerulean-blue-100 focus:outline-none focus:ring-2 focus:ring-cerulean-blue-500"
      >
        Try similarity
        <ButtonIcon />
      </Link>
    </div>
  );
}
