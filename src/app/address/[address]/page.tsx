import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAddress } from "@ethersproject/address";
import { fetchChains, fetchVerifiedAllChainsServer } from "@/utils/api";
import { orderByChains } from "@/utils/allChains";
import ChainMatchList from "@/components/ChainMatchList";
import CopyToClipboard from "@/components/CopyToClipboard";
import ErrorState from "@/components/ErrorState";

// Returns the EIP-55 checksummed address, or null if the address is invalid
function getChecksummedAddress(address: string): string | null {
  try {
    return getAddress(address.toLowerCase());
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  const displayAddress = getChecksummedAddress(address) ?? address;
  return {
    title: `${displayAddress} on all chains`,
    description: `Chains where ${displayAddress} is verified on Sourcify`,
  };
}

export default async function AddressPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;

  // Redirect to the checksummed (EIP-55) address as the canonical URL
  const checksummedAddress = getChecksummedAddress(address);
  if (!checksummedAddress) {
    notFound();
  }
  if (address !== checksummedAddress) {
    redirect(`/address/${checksummedAddress}`);
  }

  const [chains, results] = await Promise.all([
    fetchChains().catch(() => []),
    fetchVerifiedAllChainsServer(checksummedAddress).catch((error) => {
      console.error("Error fetching all-chains verification data:", error);
      return null;
    }),
  ]);

  return (
    <div className="w-full max-w-3xl mx-auto py-6">
      <p className="text-sm text-gray-500">Address</p>
      <div className="flex items-center mb-6">
        <h1 className="text-base break-all md:text-2xl font-bold font-mono text-gray-900">{checksummedAddress}</h1>
        <CopyToClipboard text={checksummedAddress} className="ml-2 md:p-0 p-2" />
      </div>
      {results === null ? (
        <ErrorState message="Could not look up this address on Sourcify. Please try again later." />
      ) : (
        <ChainMatchList address={checksummedAddress} matches={orderByChains(results, chains)} chains={chains} />
      )}
    </div>
  );
}
