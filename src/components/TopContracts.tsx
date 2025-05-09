"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchGrowthPieChains, fetchTopContractsByChain } from "@/utils/api";
import { FaCheckCircle, FaExclamationTriangle, FaTimes } from "react-icons/fa";

interface TopContract {
  address: string;
  chain_id: string;
  name: string;
  owner_project: string | null;
  usage_category: string | null;
  txcount_180d: number;
  gas_fees_usd_180d: number;
  verified?: boolean;
}

interface ChainData {
  name: string;
  evm_chain_id: number;
  chain_type: string;
  deployment: string;
  [key: string]: unknown;
}

// Chains with available top contracts data
const AVAILABLE_CHAINS = ["arbitrum", "base", "ethereum", "linea", "optimism", "taiko", "unichain", "zksync_era"];

export default function TopContracts() {
  const router = useRouter();
  const [chains, setChains] = useState<Record<string, ChainData>>({});
  const [selectedChain, setSelectedChain] = useState<string>("ethereum");
  const [topContracts, setTopContracts] = useState<TopContract[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadChains = async () => {
      const chainsData = await fetchGrowthPieChains();
      if (chainsData) {
        // Filter to include only chains with available data
        const filteredChains = Object.entries(chainsData)
          .filter((entry) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chainData = entry[1] as any;
            return AVAILABLE_CHAINS.includes(entry[0]) && chainData.evm_chain_id && chainData.deployment === "PROD";
          })
          .reduce<Record<string, ChainData>>((acc, [key, value]) => {
            acc[key] = value as ChainData;
            return acc;
          }, {});

        setChains(filteredChains);

        // Default to ethereum or first available chain
        const defaultChain = "ethereum" in filteredChains ? "ethereum" : Object.keys(filteredChains)[0];
        setSelectedChain(defaultChain);
      }
    };

    loadChains();
  }, []);

  useEffect(() => {
    if (selectedChain) {
      const loadTopContracts = async () => {
        setLoading(true);
        setError(null);
        const contracts = await fetchTopContractsByChain(selectedChain);

        if (contracts.length === 0) {
          setError(`No contract data available for ${selectedChain}`);
          setTopContracts([]);
          setLoading(false);
          return;
        }

        // Check verification status for each contract
        const contractsWithVerificationStatus = await Promise.all(
          contracts.map(async (contract: TopContract) => {
            try {
              // Extract the numeric chain ID from chain_id format "eip155:42161"
              const chainId = contract.chain_id.split(":")[1];

              // Check verification status from API
              const response = await fetch(`/api/check-verification?chainId=${chainId}&address=${contract.address}`);
              let verified = false;

              if (response.ok) {
                const data = await response.json();
                verified = data.verified;
              }

              return {
                ...contract,
                verified,
              };
            } catch {
              return {
                ...contract,
                verified: false,
              };
            }
          })
        );

        setTopContracts(contractsWithVerificationStatus);
        setLoading(false);
      };

      loadTopContracts();
    }
  }, [selectedChain]);

  const handleContractClick = (contract: TopContract) => {
    // Extract the numeric chain ID from chain_id format "eip155:42161"
    const chainId = contract.chain_id.split(":")[1];
    router.push(`/${chainId}/${contract.address}`);
  };

  if (Object.keys(chains).length === 0) {
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
          <img src="/growthepie.png" alt="GrowthePie" className="h-5 w-auto" />
        </a>
      </div>

      <div className="mb-4">
        <label htmlFor="chainSelect" className="block text-sm font-medium text-gray-700 mb-1 text-left">
          Select Chain
        </label>
        <select
          id="chainSelect"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
          className="block w-full pl-3 pr-10 py-2 text-sm bg-cerulean-blue-100 border border-cerulean-blue-300 rounded-md cursor-pointer text-cerulean-blue-600 focus:outline-none focus:ring-cerulean-blue-500 focus:border-cerulean-blue-500"
        >
          {Object.entries(chains).map(([key, chain]) => (
            <option key={key} value={key}>
              {chain.name} ({chain.evm_chain_id})
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-gray-500 mb-2 flex items-center">
        <FaCheckCircle className="h-3 w-3 text-green-500 mr-1" />
        <span>Verified contracts can be viewed in Sourcify</span>
      </div>

      {loading ? (
        <div className="text-center py-4">Loading contracts...</div>
      ) : error ? (
        <div className="text-center py-2 flex items-center justify-center text-amber-600 text-sm">
          <FaExclamationTriangle className="mr-2" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="overflow-auto max-h-[400px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-2 w-10">
                  {/* No header text for verified column */}
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Address
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topContracts.map((contract) => (
                <tr
                  key={contract.address}
                  onClick={contract.verified ? () => handleContractClick(contract) : undefined}
                  className={`${
                    contract.verified ? "cursor-pointer hover:bg-gray-50" : "cursor-not-allowed opacity-75"
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center w-10">
                    {contract.verified ? (
                      <FaCheckCircle
                        className="h-4 w-4 text-green-500 inline cursor-help verification-icon"
                        data-tooltip-id="global-tooltip"
                        data-tooltip-content="Verified on Sourcify"
                      />
                    ) : (
                      <span
                        className="cursor-help"
                        data-tooltip-id="global-tooltip"
                        data-tooltip-content="Not verified on Sourcify"
                      >
                        <FaTimes className="h-4 w-4 text-red-500 inline verification-icon" />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-left">
                    <span className={contract.verified ? "text-blue-600 hover:underline" : "text-gray-600"}>
                      {contract.name || "Unknown"}
                    </span>
                    {contract.owner_project && (
                      <div className="text-xs text-gray-500 font-normal">{contract.owner_project}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 text-left">{contract.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
