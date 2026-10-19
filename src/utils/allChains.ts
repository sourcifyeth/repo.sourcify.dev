import { ChainData } from "@/types/chain";
import { VerifiedContractMinimal } from "@/types/contract";

// No server-only env access here: this file is used by both the browser and the server.

export interface ChainMatch {
  contract: VerifiedContractMinimal;
  chain?: ChainData;
}

/**
 * Fetches all verified deployments of an address across all Sourcify chains.
 * An unverified address returns an empty array (the API returns 200 with empty `results`).
 */
export async function fetchVerifiedAllChains(
  serverUrl: string,
  address: string,
  init: RequestInit = {}
): Promise<VerifiedContractMinimal[]> {
  const response = await fetch(`${serverUrl}/v2/contract/all-chains/${address}`, init);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`Failed to fetch verified contracts: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { results: VerifiedContractMinimal[] };
  return data.results;
}

/**
 * Pairs each result with its chain and sorts them in the order of Sourcify's /chains.
 * Chains missing from /chains go last.
 */
export function orderByChains(contracts: VerifiedContractMinimal[], chains: ChainData[]): ChainMatch[] {
  const position = new Map(chains.map((chain, index) => [chain.chainId.toString(), index]));
  const chainById = new Map(chains.map((chain) => [chain.chainId.toString(), chain]));
  return contracts
    .map((contract) => ({ contract, chain: chainById.get(contract.chainId) }))
    .sort(
      (a, b) =>
        (position.get(a.contract.chainId) ?? Infinity) - (position.get(b.contract.chainId) ?? Infinity) ||
        Number(a.contract.chainId) - Number(b.contract.chainId)
    );
}
