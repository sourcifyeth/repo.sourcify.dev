import { fetchContractData, fetchChains, getChainName, checkVerification } from "@/utils/api";
import { Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import LoadingState from "@/components/LoadingState";
import { IoCheckmarkDoneCircle, IoCheckmarkCircle, IoWarning, IoCloseCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
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
import CopyToClipboardButton from "@/components/CopyToClipboardButton";
import CborAuxdataSection from "@/components/sections/CborAuxdataSection";
import CborAuxdataTransformations from "./sections/CborAuxdataTransformations";
import LibrariesSection from "./sections/LibrariesSection";
import InfoTooltip from "@/components/InfoTooltip";
import { processContractBytecodes } from "@/utils/bytecodeUtils";

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
  const [chains, contract] = await Promise.all([getChainsData(), getContractData(chainId, address)]);

  if (!contract) {
    notFound();
  }

  const chainName = getChainName(chainId, chains);

  return {
    title: `${address} on ${chainName}`,
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

  if (!contract) {
    notFound();
  }

  // Process bytecodes to insert library placeholders
  const { processedCreationBytecode, processedRuntimeBytecode } = processContractBytecodes(contract);

  // Update the contract object with processed bytecodes
  const contractWithPlaceholders = {
    ...contract,
    creationBytecode: {
      ...contract.creationBytecode,
      recompiledBytecode: processedCreationBytecode,
    },
    runtimeBytecode: {
      ...contract.runtimeBytecode,
      recompiledBytecode: processedRuntimeBytecode,
    },
  };

  // Get human-readable chain name
  const chainName = getChainName(chainId, chains);

  // Check verification status for all libraries
  const verificationStatus: Record<string, boolean> = {};

  // Flatten the compiler libraries structure to "filePath:libraryName" => "address"
  const flattenedCompilerLibraries = Object.entries(contract.compilation.compilerSettings?.libraries || {}).reduce(
    (acc, [filePath, libraries]) => {
      Object.entries(libraries as unknown as Record<string, string>).forEach(([libName, address]) => {
        acc[`${filePath}:${libName}`] = address;
      });
      return acc;
    },
    {} as Record<string, string>
  );

  const allLibraries = {
    ...flattenedCompilerLibraries,
    ...(contract.runtimeBytecode.transformationValues?.libraries || {}),
    ...(contract.creationBytecode.transformationValues?.libraries || {}),
  };

  // Check verification status for each library in parallel
  await Promise.all(
    Object.entries(allLibraries).map(async ([, address]) => {
      if (typeof address === "string") {
        try {
          verificationStatus[address] = await checkVerification(chainId, address);
        } catch (error) {
          console.error(`Error checking verification for ${address}:`, error);
          verificationStatus[address] = false;
        }
      }
    })
  );

  // Check if there are any unverified libraries
  const hasUnverifiedLibraries = Object.entries(allLibraries).some(([, address]) => !verificationStatus[address]);

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
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-md font-semibold border ${matchColor} cursor-help`}
            data-tooltip-id="global-tooltip"
            data-tooltip-content={matchTooltipContent}
          >
            <span className="mr-1 text-2xl">{matchIcon}</span> {matchLabel}
          </span>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              {contract.runtimeMatch ? (
                <IoCheckmarkCircle className="text-green-500" />
              ) : (
                <IoCloseCircle className="text-red-500" />
              )}
              <span
                className="cursor-help"
                data-tooltip-id="global-tooltip"
                data-tooltip-content={
                  contract.runtimeMatch
                    ? "Contract matched with runtime bytecode"
                    : "Contract not matched with runtime bytecode"
                }
              >
                Runtime Bytecode
              </span>
            </div>
            <div className="flex items-center gap-1">
              {contract.creationMatch ? (
                <IoCheckmarkCircle className="text-green-500" />
              ) : (
                <IoCloseCircle className="text-red-500" />
              )}
              <span
                className="cursor-help"
                data-tooltip-id="global-tooltip"
                data-tooltip-content={
                  contract.creationMatch
                    ? "Contract matched with creation bytecode"
                    : "Contract not matched with creation bytecode"
                }
              >
                Creation Bytecode
              </span>
            </div>
          </div>
          {hasUnverifiedLibraries && (
            <span
              className="flex items-center gap-1 text-yellow-600 cursor-help"
              data-tooltip-id="global-tooltip"
              data-tooltip-content="This contract uses unverified libraries. Libraries can contain arbitrary code and should be verified before interacting with the contract."
            >
              <IoWarning className="h-4 w-4" />
              <span className="text-sm">Unverified Libraries</span>
            </span>
          )}
        </div>
        {!contract.creationMatch && contract.runtimeMatch && (
          <div className="mt-2 text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 p-2 rounded">
            <div className="flex items-center gap-2">
              <IoWarning className="h-4 w-4 flex-shrink-0" />
              <span>
                Warning: This contract is only matched with runtime bytecode. The constructor may be different from the
                original one, which could affect the contract&apos;s functionality.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Contract Details Section */}
      <section className="mb-8">
        <ContractDetails contract={contractWithPlaceholders} chainName={chainName} />
      </section>

      {/* Proxy Resolution Section */}
      {contractWithPlaceholders.proxyResolution && contractWithPlaceholders.proxyResolution.isProxy && (
        <section className="mb-8">
          <div className="sticky top-0 z-10 bg-gray-100 py-4">
            <ProxyResolution proxyResolution={contractWithPlaceholders.proxyResolution} chainId={chainId} />
          </div>
        </section>
      )}

      {/* Contract ABI Section */}
      <section className="mb-8">
        <Suspense fallback={<LoadingState />}>
          <ContractAbi abi={contractWithPlaceholders.abi} />
        </Suspense>
      </section>

      {/* Contract Source Code Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Source Code</h2>
            <div className="flex items-center gap-2">
              <a
                href={`https://remix.ethereum.org/?#activate=contract-verification&call=contract-verification//lookupAndSave//sourcify//${contractWithPlaceholders.chainId}//${contractWithPlaceholders.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm bg-white rounded-md px-2 py-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200"
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
              <DownloadSourcesButton
                sources={contractWithPlaceholders.sources}
                chainId={contractWithPlaceholders.chainId}
                address={contractWithPlaceholders.address}
              />
            </div>
          </div>
        </div>

        <Suspense fallback={<LoadingState />}>
          <ContractSource contract={contractWithPlaceholders} />
        </Suspense>
      </section>

      {/* Compiler Settings Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Compiler Settings</h2>
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contractWithPlaceholders.compilation.compilerSettings} />
              <DownloadFileButton
                data={contractWithPlaceholders.compilation}
                fileName="compiler-settings"
                chainId={contractWithPlaceholders.chainId}
                address={contractWithPlaceholders.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contractWithPlaceholders.compilation.compilerSettings} />
        </Suspense>
      </section>

      {/* Libraries Section */}
      <section className="mb-8">
        <Suspense fallback={<LoadingState />}>
          <LibrariesSection
            compilation={contractWithPlaceholders.compilation}
            runtimeValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
            creationValues={contractWithPlaceholders.creationBytecode.transformationValues}
            chainId={chainId}
            verificationStatus={verificationStatus}
          />
        </Suspense>
      </section>

      {/* Contract Metadata Section */}
      <section className="mb-8">
        <div className="sticky top-0 z-10 bg-gray-100 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Contract Metadata</h2>
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contractWithPlaceholders.metadata} />
              <DownloadFileButton
                data={contractWithPlaceholders.metadata}
                fileName="metadata"
                chainId={contractWithPlaceholders.chainId}
                address={contractWithPlaceholders.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contractWithPlaceholders.metadata} />
        </Suspense>
      </section>

      {/* Creation Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        {!contractWithPlaceholders.creationMatch && (
          <div className="mb-4 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
            Contract couldn&apos;t be verified with the creation bytecode but with the runtime bytecode. Below is what
            was found at the time of verification.
          </div>
        )}
        <div className={`${!contractWithPlaceholders.creationMatch ? "opacity-60" : ""}`}>
          <div className="sticky top-0 z-10 bg-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">Creation Bytecode</h2>
          </div>
          <Suspense fallback={<LoadingState />}>
            <BytecodeDiffView
              onchainBytecode={contractWithPlaceholders.creationBytecode.onchainBytecode}
              recompiledBytecode={contractWithPlaceholders.creationBytecode.recompiledBytecode}
              id="creation"
              transformations={contractWithPlaceholders.creationBytecode.transformations}
              transformationValues={contractWithPlaceholders.creationBytecode.transformationValues}
            />
          </Suspense>

          {/* CBOR Auxdata Section */}
          <CborAuxdataSection
            cborAuxdata={contractWithPlaceholders.creationBytecode.cborAuxdata}
            language={contractWithPlaceholders.compilation.language}
          />

          {/* Creation Transformations Section */}
          {contractWithPlaceholders.creationBytecode.transformations &&
            contractWithPlaceholders.creationBytecode.transformations.length > 0 && (
              <section className="flex flex-col mt-8 border border-gray-200 rounded-lg p-4 gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-800">Transformations</h2>
                  <InfoTooltip
                    content="Transformations are the necessary changes on the non-functional recompiled bytecode sections to achieve the onchain bytecode such as libraries, immutable variables etc. <a href='https://verifieralliance.org/docs/transformations' target='_blank' rel='noopener noreferrer' style='text-decoration: underline;'>Read more</a>"
                    html={true}
                  />
                </div>
                {contractWithPlaceholders.creationBytecode.transformationValues?.libraries && (
                  <Suspense fallback={<LoadingState />}>
                    <LibraryTransformations
                      transformations={contractWithPlaceholders.creationBytecode.transformations}
                      transformationValues={contractWithPlaceholders.creationBytecode.transformationValues}
                      chainId={chainId}
                      verificationStatus={verificationStatus}
                    />
                  </Suspense>
                )}
                {contractWithPlaceholders.creationBytecode.transformationValues?.constructorArguments && (
                  <Suspense fallback={<LoadingState />}>
                    <ConstructorArguments
                      constructorArguments={
                        contractWithPlaceholders.creationBytecode.transformationValues.constructorArguments
                      }
                      abi={contractWithPlaceholders.abi}
                    />
                  </Suspense>
                )}
                {contractWithPlaceholders.creationBytecode.transformationValues?.cborAuxdata && (
                  <CborAuxdataTransformations
                    transformations={contractWithPlaceholders.creationBytecode.transformations}
                    transformationValues={contractWithPlaceholders.creationBytecode.transformationValues}
                    recompiledBytecode={contractWithPlaceholders.creationBytecode.recompiledBytecode}
                  />
                )}
              </section>
            )}
        </div>
      </section>

      {/* Runtime Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        {!contractWithPlaceholders.runtimeMatch && (
          <div className="mb-4 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
            Contract couldn&apos;t be verified with the runtime bytecode but with the creation bytecode. Below is what
            was found at the time of verification.
          </div>
        )}
        <div className={`${!contractWithPlaceholders.runtimeMatch ? "opacity-60" : ""}`}>
          <div className="sticky top-0 z-10 bg-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">Runtime Bytecode</h2>
          </div>
          <Suspense fallback={<LoadingState />}>
            <BytecodeDiffView
              onchainBytecode={contractWithPlaceholders.runtimeBytecode.onchainBytecode}
              recompiledBytecode={contractWithPlaceholders.runtimeBytecode.recompiledBytecode}
              id="runtime"
              transformations={contractWithPlaceholders.runtimeBytecode.transformations}
              transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
            />
          </Suspense>

          {/* Runtime CBOR Auxdata Section */}
          <CborAuxdataSection
            cborAuxdata={contractWithPlaceholders.runtimeBytecode.cborAuxdata}
            language={contractWithPlaceholders.compilation.language}
          />

          {/* Runtime Transformations Section */}
          {contractWithPlaceholders.runtimeBytecode.transformations &&
            contractWithPlaceholders.runtimeBytecode.transformations.length > 0 && (
              <div className="flex flex-col mt-4 border border-gray-200 rounded-lg p-4 gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-800">Transformations</h2>
                  <InfoTooltip
                    content="Transformations are the necessary changes on the non-functional recompiled bytecode sections to achieve the onchain bytecode such as libraries, immutable variables etc. <a href='https://verifieralliance.org/docs/transformations' target='_blank' rel='noopener noreferrer' style='text-decoration: underline;'>Read more</a>"
                    html={true}
                  />
                </div>
                <Suspense fallback={<LoadingState />}>
                  <LibraryTransformations
                    transformations={contractWithPlaceholders.runtimeBytecode.transformations}
                    transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
                    chainId={chainId}
                    verificationStatus={verificationStatus}
                  />
                </Suspense>

                {contractWithPlaceholders.runtimeBytecode.transformationValues?.immutables && (
                  <ImmutableTransformations
                    transformations={contractWithPlaceholders.runtimeBytecode.transformations}
                    transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
                  />
                )}

                {contractWithPlaceholders.runtimeBytecode.transformationValues?.callProtection && (
                  <CallProtectionTransformation
                    transformations={contractWithPlaceholders.runtimeBytecode.transformations}
                    transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
                  />
                )}

                {contractWithPlaceholders.runtimeBytecode.transformationValues?.cborAuxdata && (
                  <CborAuxdataTransformations
                    transformations={contractWithPlaceholders.runtimeBytecode.transformations}
                    transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
                    recompiledBytecode={contractWithPlaceholders.runtimeBytecode.recompiledBytecode}
                  />
                )}
              </div>
            )}
        </div>
      </section>

      {/* Storage Layout Section */}
      {contractWithPlaceholders.storageLayout?.types && (
        <section className="mb-8">
          <div className="sticky top-0 z-10 bg-gray-100 py-4">
            <h2 className="text-xl font-semibold text-gray-800">Storage Layout</h2>
          </div>
          <StorageLayout storageLayout={contractWithPlaceholders.storageLayout} />
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
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contractWithPlaceholders.stdJsonInput} />
              <DownloadFileButton
                data={contractWithPlaceholders.stdJsonInput}
                fileName="standard-json-input"
                chainId={contractWithPlaceholders.chainId}
                address={contractWithPlaceholders.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contractWithPlaceholders.stdJsonInput} />
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
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contractWithPlaceholders.stdJsonOutput} />
              <DownloadFileButton
                data={contractWithPlaceholders.stdJsonOutput}
                fileName="standard-json-output"
                chainId={contractWithPlaceholders.chainId}
                address={contractWithPlaceholders.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contractWithPlaceholders.stdJsonOutput} />
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
