import { NextResponse } from "next/server";
import { fetchGrowthPieChains, fetchTopContractsByChain, checkVerification } from "@/utils/api";

// Set cache control headers with a 1-hour cache time
export const revalidate = 3600; // 1 hour in seconds
export const dynamic = "force-static";

// Chains with available top contracts data
const AVAILABLE_CHAINS = ["arbitrum", "base", "ethereum", "linea", "optimism", "taiko", "unichain", "zksync_era"];

interface ChainDataItem {
  name: string;
  evm_chain_id: number;
  chain_type: string;
  deployment: string;
  [key: string]: unknown;
}

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

export async function GET() {
  try {
    // Fetch chains data first
    const chainsData = await fetchGrowthPieChains();
    if (!chainsData) {
      throw new Error("Failed to fetch chains data");
    }

    // Filter to include only chains with available data
    const filteredChains = Object.entries(chainsData)
      .filter(([key, value]) => {
        const chainData = value as Partial<ChainDataItem>;
        return (
          AVAILABLE_CHAINS.includes(key) &&
          typeof chainData.evm_chain_id === "number" &&
          chainData.deployment === "PROD"
        );
      })
      .reduce((acc, [key, value]) => {
        // Only include name and evm_chain_id from ChainDataItem
        acc[key] = {
          name: (value as ChainDataItem).name,
          evm_chain_id: (value as ChainDataItem).evm_chain_id,
        };
        return acc;
      }, {} as Record<string, Pick<ChainDataItem, "name" | "evm_chain_id">>);

    // Prepare results object
    const result: {
      chains: Record<string, Pick<ChainDataItem, "name" | "evm_chain_id">>;
      contracts: Record<string, Pick<TopContract, "address" | "name" | "owner_project" | "verified">[]>;
    } = {
      chains: filteredChains,
      contracts: {},
    };

    // Fetch top contracts for each chain in parallel
    const topContractsPromises = Object.keys(filteredChains).map(async (chainKey) => {
      try {
        const contracts = await fetchTopContractsByChain(chainKey);

        // Check verification status for each contract
        const contractsWithVerification = await Promise.all(
          contracts.map(async (contract: TopContract) => {
            try {
              // Extract the numeric chain ID from chain_id format "eip155:42161"
              const chainId = contract.chain_id.split(":")[1];

              // Check verification status
              const verified = await checkVerification(chainId, contract.address);

              // Only include the specified fields
              return {
                address: contract.address,
                name: contract.name,
                owner_project: contract.owner_project,
                verified,
              };
            } catch (err) {
              console.error("Error checking verification:", err);
              return {
                address: contract.address,
                name: contract.name,
                owner_project: contract.owner_project,
                verified: false,
              };
            }
          })
        );

        return {
          chainKey,
          contracts: contractsWithVerification,
        };
      } catch (err) {
        console.error(`Error fetching contracts for ${chainKey}:`, err);
        return {
          chainKey,
          contracts: [],
        };
      }
    });

    const topContractsResults = await Promise.all(topContractsPromises);

    // Add to final result
    topContractsResults.forEach(({ chainKey, contracts }) => {
      result.contracts[chainKey] = contracts;
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error fetching growth pie data:", err);
    return NextResponse.json({ error: "Failed to fetch growth pie data" }, { status: 500 });
  }
}
