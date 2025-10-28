import { headers } from "next/headers";
import { ChainData, ChainsResponse } from "@/types/chain";
import { getSourcifyServerUrl, revalidateTime } from "@/utils/api";

export async function fetchChains(): Promise<ChainData[]> {
  const baseUrl = getSourcifyServerUrl();
  const url = `${baseUrl}/chains`;
  const { get } = await headers();

  try {
    const response = await fetch(url, {
      next: { revalidate: revalidateTime }, // Cache for 1 hour
      headers: { Cookie: get("cookie") ?? "" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch chains data: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ChainsResponse;

    return Object.values(data);
  } catch (error) {
    console.error("Error fetching chains data:", error);
    throw error;
  }
}
