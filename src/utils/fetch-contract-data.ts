import { headers } from "next/headers";
import { getSourcifyServerUrl, revalidateTime } from "@/utils/api";
import { ContractData } from "@/types/contract";

/**
 * Fetches contract data from the Sourcify API
 * @param chainId The chain ID
 * @param address The contract address
 * @returns The contract data
 */
export async function fetchContractData(
  chainId: string,
  address: string
): Promise<ContractData> {
  const baseUrl = getSourcifyServerUrl();
  const url = `${baseUrl}/v2/contract/${chainId}/${address}?fields=all`;
  const { get } = await headers();

  try {
    const response = await fetch(url, {
      next: { revalidate: revalidateTime },
      headers: { Cookie: get("cookie") ?? "" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch contract data: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as ContractData;
  } catch (error) {
    console.error("Error fetching contract data:", error);
    throw error;
  }
}
