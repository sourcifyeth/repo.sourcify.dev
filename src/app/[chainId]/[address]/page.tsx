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
                href={`https://remix.ethereum.org/?#activate=contract-verification&call=contract-verification//lookupAndSave//sourcify//${contract.chainId}//${contract.address}`}
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
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contract.compilation.compilerSettings} />
              <DownloadFileButton
                data={contract.compilation}
                fileName="compiler-settings"
                chainId={contract.chainId}
                address={contract.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.compilation.compilerSettings} />
        </Suspense>
      </section>

      {/* Libraries Section */}
      <section className="mb-8">
        <Suspense fallback={<LoadingState />}>
          <LibrariesSection
            compilation={contract.compilation}
            runtimeValues={contract.runtimeBytecode.transformationValues}
            creationValues={contract.creationBytecode.transformationValues}
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
              <CopyToClipboardButton data={contract.metadata} />
              <DownloadFileButton
                data={contract.metadata}
                fileName="metadata"
                chainId={contract.chainId}
                address={contract.address}
              />
            </div>
          </div>
        </div>
        <Suspense fallback={<LoadingState />}>
          <JsonViewOnlyEditor data={contract.metadata} />
        </Suspense>
      </section>

      {/* Creation Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        {!contract.creationMatch && (
          <div className="mb-4 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
            Contract couldn&apos;t be verified with the creation bytecode but with the runtime bytecode. Below is what
            was found at the time of verification.
          </div>
        )}
        <div className={`${!contract.creationMatch ? "opacity-60" : ""}`}>
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
          <CborAuxdataSection
            cborAuxdata={contract.creationBytecode.cborAuxdata}
            language={contract.compilation.language}
          />

          {/* Creation Transformations Section */}
          {contract.creationBytecode.transformations && contract.creationBytecode.transformations.length > 0 && (
            <section className="flex flex-col mt-8 border border-gray-200 rounded-lg p-4 gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-800">Transformations</h2>
                <InfoTooltip
                  content="Transformations are the necessary changes on the non-functional recompiled bytecode sections to achieve the onchain bytecode such as libraries, immutable variables etc. <a href='https://verifieralliance.org/docs/transformations' target='_blank' rel='noopener noreferrer' style='text-decoration: underline;'>Read more</a>"
                  html={true}
                />
              </div>
              {contract.creationBytecode.transformationValues?.libraries && (
                <Suspense fallback={<LoadingState />}>
                  <LibraryTransformations
                    transformations={contract.creationBytecode.transformations}
                    transformationValues={contract.creationBytecode.transformationValues}
                    chainId={chainId}
                    verificationStatus={verificationStatus}
                  />
                </Suspense>
              )}
              {contract.creationBytecode.transformationValues?.constructorArguments && (
                <Suspense fallback={<LoadingState />}>
                  <ConstructorArguments
                    constructorArguments={contract.creationBytecode.transformationValues.constructorArguments}
                    abi={contract.abi}
                  />
                </Suspense>
              )}
              {contract.creationBytecode.transformationValues?.cborAuxdata && (
                <CborAuxdataTransformations
                  transformations={contract.creationBytecode.transformations}
                  transformationValues={contract.creationBytecode.transformationValues}
                  recompiledBytecode={contract.creationBytecode.recompiledBytecode}
                />
              )}
            </section>
          )}
        </div>
      </section>

      {/* Runtime Bytecode Section */}
      <section className="mb-8 border border-gray-200 rounded-lg p-6">
        {!contract.runtimeMatch && (
          <div className="mb-4 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
            Contract couldn&apos;t be verified with the runtime bytecode but with the creation bytecode. Below is what
            was found at the time of verification.
          </div>
        )}
        <div className={`${!contract.runtimeMatch ? "opacity-60" : ""}`}>
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
          <CborAuxdataSection
            cborAuxdata={contract.runtimeBytecode.cborAuxdata}
            language={contract.compilation.language}
          />

          {/* Runtime Transformations Section */}
          {contract.runtimeBytecode.transformations && contract.runtimeBytecode.transformations.length > 0 && (
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
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                  chainId={chainId}
                  verificationStatus={verificationStatus}
                />
              </Suspense>

              {contract.runtimeBytecode.transformationValues?.immutables && (
                <ImmutableTransformations
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                />
              )}

              {contract.runtimeBytecode.transformationValues?.callProtection && (
                <CallProtectionTransformation
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                />
              )}

              {contract.runtimeBytecode.transformationValues?.cborAuxdata && (
                <CborAuxdataTransformations
                  transformations={contract.runtimeBytecode.transformations}
                  transformationValues={contract.runtimeBytecode.transformationValues}
                  recompiledBytecode={contract.runtimeBytecode.recompiledBytecode}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Storage Layout Section */}
      {contract.storageLayout?.types && (
        <section className="mb-8 border border-gray-200 rounded-lg p-4">
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
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contract.stdJsonInput} />
              <DownloadFileButton
                data={contract.stdJsonInput}
                fileName="standard-json-input"
                chainId={contract.chainId}
                address={contract.address}
              />
            </div>
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
            <div className="flex items-center gap-2">
              <CopyToClipboardButton data={contract.stdJsonOutput} />
              <DownloadFileButton
                data={contract.stdJsonOutput}
                fileName="standard-json-output"
                chainId={contract.chainId}
                address={contract.address}
              />
            </div>
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
