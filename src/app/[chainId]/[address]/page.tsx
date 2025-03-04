import { fetchContractData, fetchChains, getChainName } from "@/utils/api";
import { Suspense } from "react";
import LoadingState from "@/components/LoadingState";
import ServerNavigation from "@/components/ServerNavigation";
import ErrorState from "@/components/ErrorState";
import { IoCheckmarkDoneCircle, IoCheckmarkCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import InfoTooltip from "@/components/InfoTooltip";
import ContractDetails from "@/app/[chainId]/[address]/sections/ContractDetails";
import ProxyResolution from "./sections/ProxyResolution";
import ContractAbi from "./sections/ContractAbi";
import ContractSource from "./sections/ContractSource";
import Bytecode from "@/components/Bytecode";

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

  // Tooltip content for match status
  const matchTooltipContent = isExactMatch
    ? "Exact match: The onchain and compiled bytecode match exactly, including the metadata hashes."
    : "Match: The onchain and compiled bytecode match, but metadata hashes differ or don't exist.";
  const matchTooltipHtml = `<p>${matchTooltipContent} <a href="https://docs.sourcify.dev/docs/full-vs-partial-match/" target="_blank" rel="noopener noreferrer" class="underline">Learn more</a></p>`;

  return (
    <div>
      <ServerNavigation />

      <div className="mt-3 mb-2">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold font-mono text-gray-900">{contract.address}</h1>
          <CopyToClipboard text={contract.address} className="ml-2" />
        </div>
        <p className="text-gray-700 mt-1">on {chainName}</p>
      </div>

      {/* Match status */}
      <div className="mb-6 flex items-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-md font-semibold border ${matchColor}`}>
          <span className="mr-1 text-2xl">{matchIcon}</span> {matchLabel}
        </span>
        <InfoTooltip content={matchTooltipHtml} className="ml-2" html={true} />
      </div>

      {/* Contract Details Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Contract Details</h2>
        <ContractDetails contract={contract} chainName={chainName} />
      </section>

      {/* Proxy Resolution Section */}
      {contract.proxyResolution && contract.proxyResolution.isProxy && (
        <section className="mb-8">
          <ProxyResolution proxyResolution={contract.proxyResolution} chainId={chainId} />
        </section>
      )}

      {/* Contract ABI Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">ABI</h2>
        <Suspense fallback={<LoadingState />}>
          <ContractAbi abi={contract.abi} />
        </Suspense>
      </section>

      {/* Contract Source Code Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Source Code</h2>
        <Suspense fallback={<LoadingState />}>
          <ContractSource contract={contract} />
        </Suspense>
      </section>

      {/* Creation Bytecode Section */}
      <Suspense fallback={<LoadingState />}>
        <Bytecode title="Creation Bytecode" bytecodeData={contract.creationBytecode} />
      </Suspense>

      {/* Runtime Bytecode Section */}
      <Suspense fallback={<LoadingState />}>
        <Bytecode title="Runtime Bytecode" bytecodeData={contract.runtimeBytecode} />
      </Suspense>
    </div>
  );
}
