import { fetchContractData, fetchChains, getChainName } from "@/utils/api";
import { Suspense } from "react";
import { Metadata } from "next";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { IoCheckmarkDoneCircle, IoCheckmarkCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import InfoTooltip from "@/components/InfoTooltip";
import ContractDetails from "@/app/[chainId]/[address]/sections/ContractDetails";
import ProxyResolution from "./sections/ProxyResolution";
import ContractAbi from "./sections/ABI";
import ContractSource from "./sections/ContractSource";
import JsonViewOnlyEditor from "@/components/JsonViewOnlyEditor";
import BytecodeDiffView from "@/components/BytecodeDiffView";
import LibraryTransformations from "./sections/LibraryTransformations";
import ImmutableTransformations from "./sections/ImmutableTransformations";
import CallProtectionTransformation from "./sections/CallProtectionTransformation";
import ConstructorArguments from "./sections/ConstructorArguments";
import StorageLayout from "./sections/StorageLayout";
import Image from "next/image";
import RemixLogo from "@/assets/remix.svg";
import DownloadSourcesButton from "@/components/DownloadSourcesButton";
import DownloadFileButton from "@/components/DownloadFileButton";
import CborAuxdataSection from "@/components/sections/CborAuxdataSection";

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
  params: Promise<{ chainId: string; address: string }>;
}): Promise<Metadata> {
  const { chainId, address } = await params;

  // Fetch chains data to get the network name
  const chains = await getChainsData();
  const chainName = getChainName(chainId, chains);

  return {
    title: `${address} on ${chainName} (${chainId})`,
    description: `View contract ${address} on ${chainName} network`,
    icons: {
      icon: "/favicon-verified.ico",
    },
  };
}

export default async function ContractPage({ params }: { params: Promise<{ chainId: string; address: string }> }) {
  const { chainId, address } = await params;

  // Fetch data in parallel
  const [contract, chains] = await Promise.all([getContractData(chainId, address), getChainsData()]);

  // Get human-readable chain name
  const chainName = getChainName(chainId, chains);

  if (!contract) {
    return (
      <>
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

  // Log creation and runtime transformations
  console.log("Creation transformation:", contract.creationBytecode.transformations);
  console.log("Creation values", contract.creationBytecode.transformationValues);
  console.log("Runtime transformation:", contract.runtimeBytecode.transformations);
  console.log("Runtime values", contract.runtimeBytecode.transformationValues);

  return (
    <div>
      <div className="mt-3 mb-2">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold font-mono text-gray-900">{contract.address}</h1>
          <CopyToClipboard text={contract.address} className="ml-2" />
        </div>
        <p className="text-gray-700 mt-1">
          on {chainName}
          {chains.find((c) => c.chainId.toString() === chainId)?.supported === false && (
            <span className="text-gray-500 text-sm ml-2"> (verification on this chain is deprecated)</span>
          )}
        </p>
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
        <ContractDetails contract={contract} chainName={chainName} />
      </section>

      {/* Proxy Resolution Section */}
      {contract.proxyResolution && contract.proxyResolution.isProxy && (
        <section className="mb-8">
          <div className="sticky top-0 z-10 bg-gray-100 py-4">
            <ProxyResolution proxyResolution={contract.proxyResolution} chainId={chainId} />
          </div>
        </section>
      )}

      {/* Contract ABI Section */}
      <section className="mb-8">
        <Suspense fallback={<LoadingState />}>
          <ContractAbi abi={contract.abi} />
        </Suspense>
      </section>

      {/* Contract Source Code Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Source Code</h2>
            <div className="flex items-center gap-2">
              <a
                href={`https://remix.ethereum.org/?#activate=contract-verification&call=contract-verification/lookupAndSave//sourcify//${contract.chainId}//${contract.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs bg-white rounded-md px-2 py-1 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200"
              >
                <Image
                  src={RemixLogo}
                  alt="Remix IDE Logo"
                  width={16}
                  height={16}
                  className="hover:scale-110 transition-transform duration-200"
                />
                View on Remix IDE
              </a>
              <DownloadSourcesButton sources={contract.sources} chainId={contract.chainId} address={contract.address} />
            </div>
          </div>
        </div>

        <Suspense fallback={<LoadingState />}>
          <ContractSource contract={contract} />
        </Suspense>
      </section>

      {/* Compiler Settings Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Compiler Settings</h2>
            <DownloadFileButton
              data={contract.compilation}
              fileName="compiler-settings"
              chainId={contract.chainId}
              address={contract.address}
            />
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.compilation} />
        </Suspense>
      </section>

      {/* Contract Metadata Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Contract Metadata</h2>
            <DownloadFileButton
              data={contract.metadata}
              fileName="metadata"
              chainId={contract.chainId}
              address={contract.address}
            />
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.metadata} />
        </Suspense>
      </section>

      {/* Creation Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        <div className="sticky top-0 z-10 bg-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Creation Bytecode</h2>
        </div>
        <Suspense fallback={<LoadingState />}>
          <BytecodeDiffView
            onchainBytecode={contract.creationBytecode.onchainBytecode}
            recompiledBytecode={contract.creationBytecode.recompiledBytecode}
            id="creation"
            transformations={contract.creationBytecode.transformations}
            transformationValues={contract.creationBytecode.transformationValues}
          />
        </Suspense>

        {/* CBOR Auxdata Section */}
        {
          <CborAuxdataSection
            cborAuxdata={contract.creationBytecode.cborAuxdata}
            language={contract.compilation.language}
          />
        }

        {/* Library Transformations Section */}
        {contract.creationBytecode.transformationValues?.libraries && (
          <section className="mt-8 ml-6 border border-gray-200 rounded-lg p-2">
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

        {/* Constructor Arguments Section */}
        {contract.creationBytecode.transformationValues?.constructorArguments && (
          <section className="mb-8 ml-6 border border-gray-200 rounded-lg p-2">
            <Suspense fallback={<LoadingState />}>
              <ConstructorArguments
                constructorArguments={contract.creationBytecode.transformationValues.constructorArguments}
                abi={contract.abi}
              />
            </Suspense>
          </section>
        )}
      </section>

      {/* Runtime Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        <div className="sticky top-0 z-10 bg-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Runtime Bytecode</h2>
        </div>
        <Suspense fallback={<LoadingState />}>
          <BytecodeDiffView
            onchainBytecode={contract.runtimeBytecode.onchainBytecode}
            recompiledBytecode={contract.runtimeBytecode.recompiledBytecode}
            id="runtime"
            transformations={contract.runtimeBytecode.transformations}
            transformationValues={contract.runtimeBytecode.transformationValues}
          />
        </Suspense>

        {/* Runtime CBOR Auxdata Section */}
        {
          <CborAuxdataSection
            cborAuxdata={contract.runtimeBytecode.cborAuxdata}
            language={contract.compilation.language}
          />
        }

        {/* Runtime Library Transformations Section */}
        {contract.runtimeBytecode.transformations && contract.runtimeBytecode.transformations.length > 0 && (
          <section className="mt-8 ml-6 border border-gray-200 rounded-lg p-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Transformations</h2>
            <Suspense fallback={<LoadingState />}>
              <LibraryTransformations
                transformations={contract.runtimeBytecode.transformations}
                transformationValues={contract.runtimeBytecode.transformationValues}
                chainId={chainId}
              />
            </Suspense>

            {contract.runtimeBytecode.transformationValues?.immutables && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Immutables</h3>
                <ImmutableTransformations
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                />
              </div>
            )}

            {contract.runtimeBytecode.transformationValues?.callProtection && (
              <div className="mt-8">
                <CallProtectionTransformation
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                />
              </div>
            )}
          </section>
        )}
      </section>

      {/* Storage Layout Section */}
      {contract.storageLayout?.types && (
        <section className="mb-8 border border-gray-200 rounded-lg p-2">
          <div className="sticky top-0 z-10 bg-gray-100 py-4">
            <h2 className="text-xl font-semibold text-gray-800">Storage Layout</h2>
          </div>
          <StorageLayout storageLayout={contract.storageLayout} />
        </section>
      )}

      {/* Standard JSON Input Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Standard JSON Input</h2>
              <p className="text-gray-700 text-sm">
                This isn&apos;t the original compiler JSON data. Generated for compatibility.
              </p>
            </div>
            <DownloadFileButton
              data={contract.stdJsonInput}
              fileName="standard-json-input"
              chainId={contract.chainId}
              address={contract.address}
            />
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.stdJsonInput} />
        </Suspense>
      </section>

      {/* Standard JSON Output Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Standard JSON Output</h2>
              <p className="text-gray-700 text-sm">
                This isn&apos;t the original compiler JSON data. Generated for compatibility.
              </p>
            </div>
            <DownloadFileButton
              data={contract.stdJsonOutput}
              fileName="standard-json-output"
              chainId={contract.chainId}
              address={contract.address}
            />
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.stdJsonOutput} />
        </Suspense>
      </section>
    </div>
  );
}

// This function runs on the server
async function getContractData(chainId: string, address: string) {
  try {
    return await fetchContractData(chainId, address);
  } catch (error) {
    console.error("Error fetching contract data:", error);
    return null;
  }
}
