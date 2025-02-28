import { ContractData } from "@/types/contract";
import { ChainData, ChainsResponse } from "@/types/chain";

/**
 * Fetches contract data from the Sourcify API
 * @param chainId The chain ID
 * @param address The contract address
 * @param environment The environment to use (staging or production)
 * @returns The contract data
 */
export async function fetchContractData(
  chainId: string,
  address: string,
  environment: "staging" | "production" = "production"
): Promise<ContractData> {
  const baseUrl =
    environment === "production" ? "https://sourcify.dev/server/v2" : "https://staging.sourcify.dev/server/v2";

  const url = `${baseUrl}/contract/${chainId}/${address}?fields=all`;

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour

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
export function formatAddress(address: string): string {
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

/**
 * Fetches the list of chains from Sourcify API
 * @param environment The environment to use (staging or production)
 * @returns The chains data
 */
export async function fetchChains(environment: "staging" | "production" = "production"): Promise<ChainData[]> {
  const baseUrl = environment === "production" ? "https://sourcify.dev/server" : "https://staging.sourcify.dev/server";

  const url = `${baseUrl}/chains`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch chains data: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ChainsResponse;

    // Convert the object to an array and sort by chainId
    return Object.values(data).sort((a, b) => a.chainId - b.chainId);
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
