import { ContractData } from "@/types/contract";
import { ChainData, ChainsResponse } from "@/types/chain";

const getSourcifyServerUrl = () => {
  const serverUrl = process.env.SOURCIFY_SERVER_URL;
  if (!serverUrl) {
    throw new Error("SOURCIFY_SERVER_URL is not set");
  }
  return serverUrl;
};

const revalidateTime = process.env.NODE_ENV === "production" ? 86400 : 3600; // 24 hours for production, 1 hour for development

/**
 * Fetches contract data from the Sourcify API
 * @param chainId The chain ID
 * @param address The contract address
 * @returns The contract data
 */
export async function fetchContractData(chainId: string, address: string): Promise<ContractData> {
  const baseUrl = getSourcifyServerUrl();
  const url = `${baseUrl}/v2/contract/${chainId}/${address}?fields=all`;

  try {
    const response = await fetch(url, { next: { revalidate: revalidateTime } });

    if (!response.ok) {
      throw new Error(`Failed to fetch contract data: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ContractData;
  } catch (error) {
    console.error("Error fetching contract data:", error);
    throw error;
  }
}

/**
 * Formats an address for display
 * @param address The address to format
 * @returns The formatted address
 */
export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Formats a timestamp in UTC
 * e.g. 2024-08-08 13:20:07 UTC
 */
export function formatTimestamp(timestamp: string): string {
  // Use a fixed format instead of toLocaleString to ensure consistency between server and client
  const date = new Date(timestamp);

  // Format: YYYY-MM-DD HH:MM:SS (UTC)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Truncates a string if it's too long
 * @param str The string to truncate
 * @param maxLength The maximum length
 * @returns The truncated string
 */
export function truncateString(str: string, maxLength: number = 100): string {
  if (!str || str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
}

export async function fetchChains(): Promise<ChainData[]> {
  const baseUrl = getSourcifyServerUrl();
  const url = `${baseUrl}/chains`;

  try {
    const response = await fetch(url, {
      next: { revalidate: revalidateTime }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chains data: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ChainsResponse;

    return Object.values(data);
  } catch (error) {
    console.error("Error fetching chains data:", error);
    throw error;
  }
}

/**
 * Gets a chain name by its ID from the Sourcify /chains endpoint
 * Returns the human readable format e.g. "Ethereum Mainnet (1)"
 */
export function getChainName(chainId: string | number, chains: ChainData[]): string {
  const chain = chains.find((c) => c.chainId.toString() === chainId.toString());
  if (chain) {
    return `${chain.name} (${chain.chainId})`;
  }
  return `Chain ${chainId}`;
}

// Type for verification response
interface VerificationResponse {
  match: string | null;
  creationMatch: string | null;
  runtimeMatch: string | null;
  chainId: string;
  address: string;
}

export async function checkVerification(chainId: string, address: string): Promise<boolean> {
  try {
    const baseUrl = getSourcifyServerUrl();

    const url = `${baseUrl}/v2/contract/${chainId}/${address}`;
    const response = await fetch(url, { next: { revalidate: revalidateTime } }); // Cache for 1 hour

    // Accept 2xx and 3xx status codes (< 400), but fail on 4xx and 5xx
    if (response.status >= 400) {
      return false;
    }

    const data = (await response.json()) as VerificationResponse;

    // Check if the contract is verified (match field is not null)
    return !!data.match;
  } catch (error) {
    console.error(`Error checking verification for ${address}:`, error);
    return false;
  }
}

// GrowthPie API functions
export async function fetchGrowthPieChains() {
  try {
    const response = await fetch("https://api.growthepie.xyz/v1/master.json");
    if (!response.ok) {
      throw new Error("Failed to fetch chains from GrowthPie API");
    }
    const data = await response.json();
    return data.chains;
  } catch (error) {
    console.error("Error fetching growthepie chains:", error);
    return null;
  }
}

export async function fetchTopContractsByChain(chainKey: string) {
  try {
    const response = await fetch(`https://api.growthepie.xyz/v1/top_contracts/export_${chainKey}.json`);
    if (!response.ok) {
      console.error(`Failed to fetch top contracts for ${chainKey}, status: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.slice(0, 20); // Return top 20 contracts
  } catch (error) {
    console.error(`Error fetching top contracts for ${chainKey}:`, error);
    return [];
  }
}
