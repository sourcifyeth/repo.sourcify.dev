import { fetchContractData, fetchChains, getChainName } from "@/utils/api";
import { Suspense } from "react";
import { Metadata } from "next";
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
import JsonViewOnlyEditor from "@/components/JsonViewOnlyEditor";
import ToggledRawCodeView from "@/components/ToggledRawCodeView";
import LibraryTransformations from "./sections/LibraryTransformations";
import { formatCborAuxdata } from "@/utils/format";

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

// Generate dynamic metadata for the page
export async function generateMetadata({
  params,
}: {
  params: { chainId: string; address: string };
}): Promise<Metadata> {
  const { chainId, address } = params;

  // Fetch chains data to get the network name
  const chains = await getChainsData();
  const chainName = getChainName(chainId, chains);

  return {
    title: `${address} on ${chainName} (${chainId})`,
    description: `View contract ${address} on ${chainName} network`,
  };
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

      {/* Compiler Settings Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Compiler Settings</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
          <Suspense fallback={<LoadingState />}>
            <JsonViewOnlyEditor data={contract.compilation} />
          </Suspense>
        </div>
      </section>

      {/* Contract Metadata Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Contract Metadata</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
          <Suspense fallback={<LoadingState />}>
            <JsonViewOnlyEditor data={contract.metadata} />
          </Suspense>
        </div>
      </section>

      {/* Creation Bytecode Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Creation Bytecode</h2>
        <Suspense fallback={<LoadingState />}>
          <ToggledRawCodeView
            data1={{
              name: "on-chain bytecode",
              value: contract.creationBytecode.onchainBytecode,
            }}
            data2={{
              name: "recompiled bytecode",
              value: contract.creationBytecode.recompiledBytecode,
            }}
            tooltipContent="On-chain bytecode is retrieved from the blockchain. Recompiled bytecode is generated from the source code."
          />
        </Suspense>
        {contract.creationBytecode.cborAuxdata && Object.keys(contract.creationBytecode.cborAuxdata).length > 0 && (
          <div className="mt-6 ml-6">
            <h3 className="text-xl font-semibold text-gray-800 mt-2">CBOR Auxdata</h3>
            <p className="text-gray-700 mb-2 text-sm">
              These values are from the recompiled bytecode. If these values are different in the on-chain bytecode,
              they will show up in Transformations section.
            </p>
            {Object.entries(contract.creationBytecode.cborAuxdata).map(([key, cborAuxdataObj]) => (
              <div key={key} className="mb-4">
                <h4 className="text-md font-medium text-gray-700 mb-2">CBOR Auxdata id: {key}</h4>
                <Suspense fallback={<LoadingState />}>
                  <ToggledRawCodeView
                    data1={{
                      name: "Raw",
                      value: cborAuxdataObj.value,
                    }}
                    data2={{
                      name: "Decoded",
                      value: JSON.stringify(
                        formatCborAuxdata(cborAuxdataObj.value, contract.compilation.language),
                        null,
                        2
                      ),
                      notBytes: true,
                    }}
                  />
                </Suspense>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CBOR Auxdata Section */}
      {contract.creationBytecode.cborAuxdata &&
        Object.keys(contract.creationBytecode.cborAuxdata).length > 0 &&
        contract.creationBytecode.cborAuxdata.value && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">CBOR Auxdata</h2>
            <Suspense fallback={<LoadingState />}>
              <ToggledRawCodeView
                data1={{
                  name: "Raw CBOR",
                  value:
                    typeof contract.creationBytecode.cborAuxdata.value === "string"
                      ? contract.creationBytecode.cborAuxdata.value
                      : JSON.stringify(contract.creationBytecode.cborAuxdata.value || {}),
                }}
                data2={{
                  name: "Decoded CBOR",
                  value: JSON.stringify(contract.creationBytecode.cborAuxdata.decoded || {}, null, 2),
                }}
                tooltipContent="CBOR Auxdata contains metadata about the contract compilation, including IPFS hashes of source files"
                className="bg-white shadow overflow-hidden sm:rounded-lg p-4"
              />
            </Suspense>
          </section>
        )}

      {/* Library Transformations Section */}
      {contract.creationBytecode.transformations && contract.creationBytecode.transformations.length > 0 && (
        <section className="mb-8 ml-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Transformations</h2>
          <Suspense fallback={<LoadingState />}>
            <LibraryTransformations
              transformations={contract.creationBytecode.transformations}
              transformationValues={contract.creationBytecode.transformationValues}
              chainId={chainId}
            />
          </Suspense>
        </section>
      )}

      {/* Runtime Bytecode Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Runtime Bytecode</h2>
        <Suspense fallback={<LoadingState />}>
          <ToggledRawCodeView
            data1={{
              name: "on-chain bytecode",
              value: contract.runtimeBytecode.onchainBytecode,
            }}
            data2={{
              name: "recompiled bytecode",
              value: contract.runtimeBytecode.recompiledBytecode,
            }}
            tooltipContent="On-chain bytecode is retrieved from the blockchain. Recompiled bytecode is generated from the source code."
          />
        </Suspense>
      </section>
    </div>
  );
}
