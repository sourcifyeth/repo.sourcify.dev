"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import Image from "next/image";
import OptionDropdown from "./OptionDropdown";
import { MatchBadge } from "./ChainMatchList";

interface TopContract {
  address: string;
  name: string;
  owner_project: string | null;
  verified?: boolean;
  match?: "match" | "exact_match" | null;
}

interface ChainData {
  name: string;
  evm_chain_id: number;
}

export default function TopContracts() {
  const [chains, setChains] = useState<Record<string, ChainData>>({});
  const [selectedChain, setSelectedChain] = useState<string>("ethereum");
  const [allContracts, setAllContracts] = useState<Record<string, TopContract[]>>({});
  const [topContracts, setTopContracts] = useState<TopContract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        // Fetch all data from our server-side cached API
        const response = await fetch("/api/growthepie-contracts");

        if (!response.ok) {
          throw new Error("Failed to fetch contract data");
        }

        const data = await response.json();

        // Set chains data
        setChains(data.chains);

        // Set all contracts data
        setAllContracts(data.contracts);

        // Default to ethereum or first available chain
        const defaultChain = "ethereum" in data.chains ? "ethereum" : Object.keys(data.chains)[0];
        setSelectedChain(defaultChain);

        // Set initial contracts for the default chain
        if (data.contracts[defaultChain] && data.contracts[defaultChain].length > 0) {
          setTopContracts(data.contracts[defaultChain]);
        } else {
          setError(`No contract data available for ${defaultChain}`);
        }
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load contract data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Update displayed contracts when selected chain changes
  useEffect(() => {
    if (selectedChain && allContracts[selectedChain]) {
      if (allContracts[selectedChain].length > 0) {
        setTopContracts(allContracts[selectedChain]);
        setError(null);
      } else {
        setTopContracts([]);
        setError(`No contract data available for ${selectedChain}`);
      }
    } else if (selectedChain) {
      setTopContracts([]);
      setError(`No contract data available for ${selectedChain}`);
    }
  }, [selectedChain, allContracts]);

  const chainId = chains[selectedChain]?.evm_chain_id.toString();

  if (Object.keys(chains).length === 0 && !error) {
    return <div className="text-center py-4">Loading chains...</div>;
  }

  return (
    <>
      <h4 className="text-lg font-medium text-gray-700 text-center">Most Used Contracts</h4>
      <div className="text-sm text-gray-500 mb-3 flex items-center justify-center">
        by
        <a
          href="https://www.growthepie.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 inline-flex items-center hover:opacity-80 transition-opacity"
        >
          <Image src="/growthepie.png" alt="GrowthePie" width={80} height={20} className="h-5 w-auto" />
        </a>
      </div>

      <div className="mb-4">
        <OptionDropdown
          id="chainSelect"
          ariaLabel="Select chain"
          value={selectedChain}
          onChange={setSelectedChain}
          disabled={loading}
          options={Object.entries(chains).map(([key, chain]) => ({
            value: key,
            label: chain.name,
            detail: `Chain ID: ${chain.evm_chain_id}`,
          }))}
        />
      </div>

      {loading ? (
        <div className="text-center py-4">Loading contracts...</div>
      ) : error ? (
        <div className="text-center py-2 flex items-center justify-center text-amber-600 text-sm">
          <FaExclamationTriangle className="mr-2" />
          <span>{error}</span>
        </div>
      ) : (
        <ul className="scrollbar-visible h-[420px] overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100 text-left">
          {topContracts.map((contract, index) => {
            const text = (
              <>
                <span className="w-[18px] shrink-0 text-center text-sm tabular-nums text-gray-400">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{contract.name || "Unknown"}</div>
                  <div className="truncate text-xs font-mono text-cerulean-blue-600">{contract.address}</div>
                  {contract.owner_project && (
                    <div className="truncate text-xs text-gray-500">{contract.owner_project}</div>
                  )}
                </div>
              </>
            );
            return (
              <li key={contract.address}>
                {contract.verified && chainId ? (
                  <Link
                    href={`/${chainId}/${contract.address}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-cerulean-blue-100 focus:bg-cerulean-blue-100 focus:outline-none"
                  >
                    {text}
                    <span className="shrink-0">
                      <MatchBadge match={contract.match ?? "match"} />
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2 opacity-60">
                    {text}
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-gray-100 text-gray-600 border-gray-200">
                      <FaTimes className="w-3 h-3" />
                      Not verified
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
