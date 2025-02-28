import { fetchContractData, fetchChains, getChainName } from "@/utils/api";
import { Suspense } from "react";
import ContractPageClient from "./client";
import LoadingState from "@/components/LoadingState";
import ServerNavigation from "@/components/ServerNavigation";
import ErrorState from "@/components/ErrorState";
import { IoCheckmarkDoneCircle, IoCheckmarkCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";

// This function runs on the server
async function getContractData(chainId: string, address: string) {
  try {
    return await fetchContractData(chainId, address);
  } catch (error) {
    console.error("Error fetching contract data:", error);
    return null;
  }
}

// Fetch chains data
async function getChainsData() {
  try {
    return await fetchChains();
  } catch (error) {
    console.error("Error fetching chains data:", error);
    return [];
  }
}

export default async function ContractPage({ params }: { params: { chainId: string; address: string } }) {
  const { chainId, address } = await params;

  // Fetch data in parallel
  const [contract, chains] = await Promise.all([getContractData(chainId, address), getChainsData()]);

  // Get human-readable chain name
  const chainName = getChainName(chainId, chains);

  if (!contract) {
    return (
      <>
        <ServerNavigation />
        <ErrorState message="Failed to load contract data or contract not found" />
      </>
    );
  }

  // Determine if this is an exact match
  const isExactMatch = contract.creationMatch === "exact_match" || contract.runtimeMatch === "exact_match";
  const matchLabel = isExactMatch ? "Exact Match" : "Match";
  // Always use green color
  const matchColor = "bg-green-100 text-green-800 border-green-200";
  const matchIcon = isExactMatch ? <IoCheckmarkDoneCircle /> : <IoCheckmarkCircle />;

  return (
    <div>
      <ServerNavigation />

      <div className="mt-3 mb-1">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold font-mono text-gray-900">{contract.address}</h1>
          <CopyToClipboard text={contract.address} className="ml-2" />
        </div>
        <p className="text-gray-700 mt-1">on {chainName}</p>
      </div>

      {/* Match status */}
      <div className="mb-6">
        <span className={`inline-flex items-center px-3 py-1 rounded-md font-semibold border ${matchColor}`}>
          <span className="mr-1">{matchIcon}</span> {matchLabel}
        </span>
      </div>

      <Suspense fallback={<LoadingState />}>
        <ContractPageClient contract={contract} chainName={chainName} />
      </Suspense>
    </div>
  );
}
