import { headers } from "next/headers";
import { getSourcifyServerUrl, revalidateTime } from "@/utils/api";

// Type for verification response
interface VerificationResponse {
  match: string | null;
  creationMatch: string | null;
  runtimeMatch: string | null;
  chainId: string;
  address: string;
}

export async function checkVerification(
  chainId: string,
  address: string
): Promise<boolean> {
  try {
    const baseUrl = getSourcifyServerUrl();

    const url = `${baseUrl}/v2/contract/${chainId}/${address}`;
    const { get } = await headers();
    const response = await fetch(url, {
      // Cache for 1 hour
      next: { revalidate: revalidateTime },
      headers: { Cookie: get("cookie") ?? "" },
    });

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
