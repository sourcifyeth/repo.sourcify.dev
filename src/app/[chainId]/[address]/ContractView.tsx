import { fetchContractData, fetchChains, getChainName, getSourcifyServerUrl } from "@/utils/api";
import { isHeuristicProxyResolution } from "@/utils/proxy";
import type { AbiEntry } from "@/utils/interact/abi";
import Interaction from "./sections/interact/Interaction";
import SimilarityVerification from "./SimilarityVerification";
import ErrorState from "@/components/ErrorState";
import { Suspense } from "react";
import { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import LoadingState from "@/components/LoadingState";
import { IoCheckmarkDoneCircle, IoCheckmarkCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import SectionNav, { PageSection } from "@/components/SectionNav";
import LazyJsonSection from "@/components/LazyJsonSection";
import ProxyResolution from "./sections/ProxyResolution";
import { ContractHeader, canInteract, checkLibraries, getChecksummedAddress, isValidChainId } from "./ContractHeader";
import ContractTabs from "./ContractTabs";
import ContractAbi from "./sections/ABI";
import ContractSource from "./sections/ContractSource";
import { SourceViewData } from "@/types/contract";
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
import semver from "semver";

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
export async function contractMetadata({
  params,
}: {
  params: Promise<{ chainId: string; address: string }>;
}): Promise<Metadata> {
  const { chainId, address } = await params;

  // The page 404s on malformed params and redirects non-checksummed addresses
  // to the canonical URL: no point in fetching the contract for those.
  const checksummedAddress = getChecksummedAddress(address);
  if (!isValidChainId(chainId) || !checksummedAddress || address !== checksummedAddress) {
    return {};
  }

  // The page reports a failed contract fetch (it throws and renders the error
  // boundary). Here it only means the verification status is unknown, so fall
  // back to neutral metadata rather than describing the contract as unverified.
  const [chains, { contract, fetchFailed }] = await Promise.all([
    getChainsData(),
    fetchContractData(chainId, address).then(
      (contract) => ({ contract, fetchFailed: false }),
      () => ({ contract: null, fetchFailed: true })
    ),
  ]);

  const chainName = getChainName(chainId, chains);
  const displayAddress = contract?.address || checksummedAddress;
  const title = `${displayAddress} on ${chainName}`;

  // The preview image (opengraph-image.tsx) needs an absolute URL. Build it from the
  // request's host, so production, staging and preview deploys each link their own image.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;

  // Link previews show the contract name; the tab title stays address-first
  const previewTitle = contract ? `${contract.compilation.name} on ${chainName}` : title;
  const description = fetchFailed
    ? undefined
    : contract
      ? `Verified source code, ABI and bytecode of ${contract.compilation.name} (${displayAddress}) on ${chainName}, from Sourcify`
      : `Contract ${displayAddress} on ${chainName} network is not verified on Sourcify`;
  const social = {
    metadataBase,
    openGraph: {
      title: previewTitle,
      description,
      url: `/${chainId}/${checksummedAddress}`,
      siteName: "repo.sourcify.dev",
      type: "website" as const,
    },
    twitter: { card: "summary_large_image" as const, title: previewTitle, description },
  };

  if (fetchFailed) {
    return { title, ...social };
  }

  if (!contract) {
    return { title, description, ...social };
  }

  return {
    title,
    description,
    ...social,
    icons: {
      icon: "/favicon-verified.ico",
    },
  };
}

/**
 * The contract page with its two tabs, "Code" and "Read/Write Contract". Both URLs render this page;
 * `tab` says which tab is open first. A tab switch happens in the browser only (see ContractTabs).
 */
export default async function ContractView({
  params,
  tab,
}: {
  params: Promise<{ chainId: string; address: string }>;
  tab: "code" | "read-write";
}) {
  const { chainId, address } = await params;

  if (!isValidChainId(chainId)) {
    notFound();
  }

  // Redirect to the checksummed (EIP-55) address as the canonical URL
  const checksummedAddress = getChecksummedAddress(address);
  if (!checksummedAddress) {
    notFound();
  }
  if (address !== checksummedAddress) {
    redirect(`/${chainId}/${checksummedAddress}${tab === "read-write" ? "/read-write" : ""}`);
  }

  // Fetch data in parallel. fetchContractData returns null if the contract is
  // not verified (404). Any other failure (rate limited, unreachable server,
  // malformed response...) is deliberately not caught here: it propagates to
  // the error boundary (error.tsx) and renders as an error, not as "not found"
  // (github issue #84).
  const [contract, chains] = await Promise.all([fetchContractData(chainId, checksummedAddress), getChainsData()]);

  // Get human-readable chain name
  const chainName = getChainName(chainId, chains);

  // The contract is not verified: try to verify it via similarity search.
  // Don't even try for unknown chains or chains whose verification is
  // deprecated (verified contracts on deprecated chains are still served from
  // the database and never reach this branch); only trust these checks when
  // the chains list actually loaded.
  if (!contract && tab === "read-write") redirect(`/${chainId}/${checksummedAddress}`);
  if (!contract) {
    const chain = chains.find((c) => c.chainId.toString() === chainId);
    const isChainUnknown = chains.length > 0 && !chain;
    const isChainDeprecated = !!chain && chain.supported === false;
    return (
      <div>
        <div className="mt-3 mb-2">
          <div className="flex items-center">
            <h1 className="text-base break-all md:text-2xl font-bold font-mono text-gray-900">{checksummedAddress}</h1>
            <CopyToClipboard text={checksummedAddress} className="ml-2 md:p-0 p-2" />
          </div>
          <p className="text-sm md:text-base text-gray-700 mt-1">on {chainName}</p>
        </div>
        {isChainUnknown ? (
          <ErrorState
            message="Contract not found"
            secondaryMessage={`Chain ${chainId} is not supported on Sourcify.`}
          />
        ) : isChainDeprecated ? (
          <ErrorState message="Contract not found" secondaryMessage="Verification on this chain is deprecated." />
        ) : (
          <SimilarityVerification chainId={chainId} address={checksummedAddress} serverUrl={getSourcifyServerUrl()} />
        )}
      </div>
    );
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

  const { verificationStatus, hasUnverifiedLibraries } = await checkLibraries(contract, chainId);

  // Check Solidity version for storage layout availability
  const isSolidity = contract.compilation.language.toLowerCase() === "solidity";
  const compilerVersion = semver.coerce(contract.compilation.compilerVersion);
  const isVyper = contract.compilation.language.toLowerCase() === "vyper";
  const hasStorageLayoutSupport = isSolidity && compilerVersion && semver.gte(compilerVersion, "0.5.13");
  const hasVyperStorageLayoutSupport = isVyper && compilerVersion && semver.gte(compilerVersion, "0.4.1");
  const hasTransientStorageLayoutSupport = isSolidity && compilerVersion && semver.gte(compilerVersion, "0.8.27");
  const hasMetadataSupport = isSolidity && compilerVersion && semver.gte(compilerVersion, "0.4.7");

  // Determine if this is an exact match
  const isExactMatch = contract.creationMatch === "exact_match" || contract.runtimeMatch === "exact_match";
  const matchLabel = isExactMatch ? "Exact Match" : "Match";
  // Always use green color
  const matchColor = "bg-green-100 text-green-800 border-green-200";
  const matchIcon = isExactMatch ? <IoCheckmarkDoneCircle /> : <IoCheckmarkCircle />;

  // Only the fields that the source view reads: React writes long strings (bytecodes, source maps)
  // into the page again for every client component that gets them. Objects are sent once.
  const sourceViewData: SourceViewData = {
    sources: contractWithPlaceholders.sources,
    sourceIds: contractWithPlaceholders.sourceIds,
    signatures: contractWithPlaceholders.signatures,
    userdoc: contractWithPlaceholders.userdoc,
    devdoc: contractWithPlaceholders.devdoc,
    compilation: {
      fullyQualifiedName: contractWithPlaceholders.compilation.fullyQualifiedName,
      compilerSettings: contractWithPlaceholders.compilation.compilerSettings,
    },
  };
  // A bytecode viewer gets the recompiled text only if it differs from the on-chain text
  const differentOrUndefined = (onchain: string, recompiled: string) =>
    onchain && onchain === recompiled ? undefined : recompiled;

  // The "Read/Write Contract" tab: for a contract with functions in its ABI, or a proxy
  const showInteraction = canInteract(contract);
  if (tab === "read-write" && !showInteraction) redirect(`/${chainId}/${contract.address}`);

  // The sections in the section list, in page order (only those that the page shows). Each label is the section's heading.
  const pageSections: PageSection[] = [
    ...(contractWithPlaceholders.proxyResolution?.isProxy ? [{ id: "proxy", label: "Proxy" }] : []),
    ...((contractWithPlaceholders.abi?.length ?? 0) > 0 ? [{ id: "abi", label: "ABI" }] : []),
    { id: "source-code", label: "Source Code" },
    { id: "compiler-settings", label: "Compiler Settings" },
    { id: "metadata", label: "Metadata.json" },
    { id: "creation-bytecode", label: "Creation Bytecode" },
    { id: "runtime-bytecode", label: "Runtime Bytecode" },
    { id: "storage-layout", label: "Storage Layout" },
    { id: "transient-storage-layout", label: "Transient Storage Layout" },
    { id: "standard-json-input", label: "Standard JSON Input" },
    { id: "standard-json-output", label: "Standard JSON Output" },
  ];

  return (
    <div>
      <ContractHeader
        contract={contract}
        details={contractWithPlaceholders}
        chainId={chainId}
        chainName={chainName}
        chains={chains}
        hasUnverifiedLibraries={hasUnverifiedLibraries}
        proxyHref="#proxy"
      />
      <ContractTabs
        chainId={chainId}
        address={contract.address}
        initialTab={tab}
        code={
          <>
            {/* From 1280 px the section list is a sidebar on the left; below that, a bar on top */}
            <div className="xl:grid xl:grid-cols-[12rem_minmax(0,1fr)] xl:gap-8">
              <SectionNav sections={pageSections} />
              <div className="min-w-0">
                {/* Proxy Resolution Section */}
                {contractWithPlaceholders.proxyResolution && contractWithPlaceholders.proxyResolution.isProxy && (
                  <section id="proxy" className="mt-6 mb-4 page-section">
                    <div className="bg-gray-100">
                      <ProxyResolution proxyResolution={contractWithPlaceholders.proxyResolution} chainId={chainId} />
                    </div>
                  </section>
                )}

                {/* Contract ABI Section */}
                {(contractWithPlaceholders.abi?.length ?? 0) > 0 && (
                  <section id="abi" className="mb-8 page-section">
                    <Suspense fallback={<LoadingState />}>
                      <ContractAbi abi={contractWithPlaceholders.abi!} />
                    </Suspense>
                  </section>
                )}

                {/* Contract Source Code Section. The id is the scroll target for #file=… links. */}
                <section id="source-code" className="mb-8 page-section">
                  <div className="bg-gray-100 pt-4 pb-2">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <h2 className="text-xl font-semibold text-gray-800">Source Code</h2>
                      <div className="flex items-center gap-2 text-xs md:text-sm">
                        <a
                          href={`https://remix.ethereum.org/?#activate=contract-verification&call=contract-verification//lookupAndSave//sourcify//${contractWithPlaceholders.chainId}//${contractWithPlaceholders.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-white rounded-md px-2 py-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200"
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

                  {/* What the match type says about these source files, with the same badge as the page header */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs md:text-sm text-gray-700">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold border ${matchColor} flex-shrink-0`}
                    >
                      <span className="mr-1 text-base">{matchIcon}</span> {matchLabel}
                    </span>
                    <p>
                      {isExactMatch
                        ? "These are the original source files, byte for byte."
                        : "The source files compile to the same bytecode, but comments, variable names and whitespace may differ from the original."}{" "}
                      <a
                        href="https://docs.sourcify.dev/docs/full-vs-partial-match/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Learn more
                      </a>
                    </p>
                  </div>

                  <Suspense fallback={<LoadingState />}>
                    <ContractSource contract={sourceViewData} />
                  </Suspense>
                </section>

                {/* Compiler Settings Section */}
                <section id="compiler-settings" className="mb-8 page-section">
                  <div className="bg-gray-100 py-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                      <h2 className="text-xl font-semibold text-gray-800">Compiler Settings</h2>
                      <div className="flex items-center gap-2 text-xs md:text-sm">
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

                {/* Contract Metadata Section. The browser loads the metadata when the section comes into view. */}
                <section id="metadata" className="mb-8 page-section">
                  <LazyJsonSection
                    field="metadata"
                    chainId={chainId}
                    address={contractWithPlaceholders.address}
                    serverUrl={getSourcifyServerUrl()}
                    fileName="metadata"
                    header={
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-xl font-semibold text-gray-800">Metadata.json</h2>
                        <a
                          href="https://playground.sourcify.dev"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
                        >
                          What&apos;s metadata?
                        </a>
                      </div>
                    }
                    unavailableMessage={
                      !isSolidity
                        ? "Contract metadata is not available for non-Solidity contracts."
                        : !hasMetadataSupport
                          ? "Contract metadata is only available for Solidity contracts compiled with version ≥ 0.4.7."
                          : undefined
                    }
                    emptyMessage="No contract metadata found in the compiler output."
                  />
                </section>

                {/* Creation Bytecode Section */}
                <section
                  id="creation-bytecode"
                  className="mb-8 border border-gray-200 rounded-lg p-3 md:p-6 page-section"
                >
                  {!contractWithPlaceholders.creationMatch && (
                    <div className="mb-4 text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
                      Contract couldn&apos;t be verified with the creation bytecode but with the runtime bytecode. Below
                      is what was found at the time of verification.
                    </div>
                  )}
                  <div className={`${!contractWithPlaceholders.creationMatch ? "opacity-60" : ""}`}>
                    <div className="bg-gray-100">
                      <h2 className="text-xl font-semibold text-gray-800">Creation Bytecode</h2>
                    </div>
                    <Suspense fallback={<LoadingState />}>
                      <BytecodeDiffView
                        onchainBytecode={contractWithPlaceholders.creationBytecode.onchainBytecode}
                        recompiledBytecode={differentOrUndefined(
                          contractWithPlaceholders.creationBytecode.onchainBytecode,
                          contractWithPlaceholders.creationBytecode.recompiledBytecode
                        )}
                        id="creation"
                        transformations={contractWithPlaceholders.creationBytecode.transformations}
                        transformationValues={contractWithPlaceholders.creationBytecode.transformationValues}
                        recompiledBytecodeCborAuxdata={contractWithPlaceholders.creationBytecode.cborAuxdata}
                        signatures={contractWithPlaceholders.signatures}
                        sourceMap={contractWithPlaceholders.creationBytecode.sourceMap}
                        sourceIds={contractWithPlaceholders.sourceIds}
                      />
                    </Suspense>

                    {/* CBOR Auxdata Section */}
                    <CborAuxdataSection
                      cborAuxdata={contractWithPlaceholders.creationBytecode.cborAuxdata}
                      onchainCborAuxdata={contractWithPlaceholders.creationBytecode.transformationValues?.cborAuxdata}
                      matched={Boolean(contract.creationMatch)}
                      language={contractWithPlaceholders.compilation.language}
                      compilerVersion={contractWithPlaceholders.compilation.compilerVersion}
                    />

                    {/* Creation Transformations Section */}
                    {contractWithPlaceholders.creationBytecode.transformations &&
                      contractWithPlaceholders.creationBytecode.transformations.length > 0 && (
                        <section className="flex flex-col mt-8 border border-gray-200 rounded-lg p-4 gap-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-semibold text-gray-800">Transformations</h2>
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
                                abi={contractWithPlaceholders.abi ?? []}
                              />
                            </Suspense>
                          )}
                          {contractWithPlaceholders.creationBytecode.transformationValues?.cborAuxdata && (
                            <CborAuxdataTransformations
                              transformations={contractWithPlaceholders.creationBytecode.transformations}
                              transformationValues={contractWithPlaceholders.creationBytecode.transformationValues}
                              recompiledBytecode={contractWithPlaceholders.creationBytecode.recompiledBytecode}
                              recompiledBytecodeCborAuxdata={contractWithPlaceholders.creationBytecode.cborAuxdata}
                            />
                          )}
                        </section>
                      )}
                  </div>
                </section>

                {/* Runtime Bytecode Section */}
                <section
                  id="runtime-bytecode"
                  className="mb-8 border border-gray-200 rounded-lg p-3 md:p-6 page-section"
                >
                  {!contractWithPlaceholders.runtimeMatch && (
                    <div className="mb-4 text-xs md:text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-3 rounded">
                      Contract couldn&apos;t be verified with the runtime bytecode but with the creation bytecode. Below
                      is what was found at the time of verification.
                    </div>
                  )}
                  <div className={`${!contractWithPlaceholders.runtimeMatch ? "opacity-60" : ""}`}>
                    <div className="bg-gray-100">
                      <h2 className="text-xl font-semibold text-gray-800">Runtime Bytecode</h2>
                    </div>
                    <Suspense fallback={<LoadingState />}>
                      <BytecodeDiffView
                        onchainBytecode={contractWithPlaceholders.runtimeBytecode.onchainBytecode}
                        recompiledBytecode={differentOrUndefined(
                          contractWithPlaceholders.runtimeBytecode.onchainBytecode,
                          contractWithPlaceholders.runtimeBytecode.recompiledBytecode
                        )}
                        id="runtime"
                        transformations={contractWithPlaceholders.runtimeBytecode.transformations}
                        transformationValues={contractWithPlaceholders.runtimeBytecode.transformationValues}
                        recompiledBytecodeCborAuxdata={contractWithPlaceholders.runtimeBytecode.cborAuxdata}
                        signatures={contractWithPlaceholders.signatures}
                        sourceMap={contractWithPlaceholders.runtimeBytecode.sourceMap}
                        sourceIds={contractWithPlaceholders.sourceIds}
                      />
                    </Suspense>

                    {/* Runtime CBOR Auxdata Section */}
                    <CborAuxdataSection
                      cborAuxdata={contractWithPlaceholders.runtimeBytecode.cborAuxdata}
                      onchainCborAuxdata={contractWithPlaceholders.runtimeBytecode.transformationValues?.cborAuxdata}
                      matched={Boolean(contract.runtimeMatch)}
                      language={contractWithPlaceholders.compilation.language}
                      compilerVersion={contractWithPlaceholders.compilation.compilerVersion}
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
                              recompiledBytecodeCborAuxdata={contractWithPlaceholders.runtimeBytecode.cborAuxdata}
                            />
                          )}
                        </div>
                      )}
                  </div>
                </section>

                {/* Storage Layout Section */}
                <section id="storage-layout" className="mb-8 page-section">
                  <div className="bg-gray-100 py-4">
                    <h2 className="text-xl font-semibold text-gray-800">Storage Layout</h2>
                    <div className="text-gray-700 text-sm">
                      For non-default storage allocations (e.g.{" "}
                      <a
                        href="https://eips.ethereum.org/EIPS/eip-7201"
                        target="_blank"
                        rel="noopener"
                        className="text-blue-500"
                      >
                        EIP-7201
                      </a>
                      ) check out{" "}
                      <a
                        href={`https://evm-storage.codes?address=${contractWithPlaceholders.address}&chainId=${contractWithPlaceholders.chainId}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-block"
                      >
                        <Image
                          src="/evm-storage.png"
                          alt="EVM Storage Logo"
                          height={24}
                          width={140}
                          className="inline-block p-1 bg-black rounded-md w-[110px] md:w-[140px] object-contain"
                        />
                      </a>
                    </div>
                  </div>
                  {contractWithPlaceholders.storageLayout &&
                  Object.keys(contractWithPlaceholders.storageLayout).length > 0 ? (
                    <StorageLayout
                      storageLayout={contractWithPlaceholders.storageLayout}
                      sourcePath={contract.compilation.fullyQualifiedName.slice(
                        0,
                        contract.compilation.fullyQualifiedName.lastIndexOf(":")
                      )}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg p-4">
                      <div className="text-gray-700 text-sm">
                        {isSolidity && !hasStorageLayoutSupport
                          ? "Storage layout is only available for Solidity contracts compiled with version ≥ 0.5.13."
                          : isVyper && !hasVyperStorageLayoutSupport
                            ? "Storage layout is only available for Vyper contracts compiled with version ≥ 0.4.1."
                            : "No storage layouts found in the compiler output."}
                      </div>
                    </div>
                  )}
                </section>

                {/* Storage Layout Overrides Section (Vyper) */}
                {contractWithPlaceholders.additionalInput?.storage_layout_overrides &&
                  Object.keys(contractWithPlaceholders.additionalInput.storage_layout_overrides).length > 0 && (
                    <section className="mb-8">
                      <div className="bg-gray-100 py-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                          <h2 className="text-xl font-semibold text-gray-800">Storage Layout Overrides</h2>
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            <CopyToClipboardButton
                              data={contractWithPlaceholders.additionalInput.storage_layout_overrides}
                            />
                            <DownloadFileButton
                              data={contractWithPlaceholders.additionalInput.storage_layout_overrides}
                              fileName="storage-layout-overrides"
                              chainId={contractWithPlaceholders.chainId}
                              address={contractWithPlaceholders.address}
                            />
                          </div>
                        </div>
                        <p className="text-gray-700 text-sm">
                          Custom storage slot assignments provided as compiler input for this Vyper contract.
                        </p>
                      </div>
                      <Suspense fallback={<LoadingState />}>
                        <JsonViewOnlyEditor data={contractWithPlaceholders.additionalInput.storage_layout_overrides} />
                      </Suspense>
                    </section>
                  )}

                {/* Transient Storage Layout Section */}
                <section id="transient-storage-layout" className="mb-8 page-section">
                  <div className="bg-gray-100 py-4">
                    <h2 className="text-xl font-semibold text-gray-800">Transient Storage Layout</h2>
                  </div>
                  {contractWithPlaceholders.transientStorageLayout?.types ? (
                    <StorageLayout
                      storageLayout={contractWithPlaceholders.transientStorageLayout}
                      sourcePath={contract.compilation.fullyQualifiedName.slice(
                        0,
                        contract.compilation.fullyQualifiedName.lastIndexOf(":")
                      )}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg p-4">
                      <div className="text-gray-700 text-sm">
                        {!hasTransientStorageLayoutSupport
                          ? "Transient storage layout is only available for Solidity contracts compiled with version ≥ 0.8.27."
                          : "No transient storage layouts found in the compiler output."}
                      </div>
                    </div>
                  )}
                </section>

                {/* Standard JSON Input and Output. The browser loads each one when its section comes into view. */}
                <section id="standard-json-input" className="mb-8 page-section">
                  <LazyJsonSection
                    field="stdJsonInput"
                    chainId={chainId}
                    address={contractWithPlaceholders.address}
                    serverUrl={getSourcifyServerUrl()}
                    fileName="standard-json-input"
                    header={
                      <>
                        <h2 className="text-xl font-semibold text-gray-800">Standard JSON Input</h2>
                        <p className="text-gray-700 text-sm">
                          This isn&apos;t the original compiler JSON data. Generated for compatibility.
                        </p>
                      </>
                    }
                  />
                </section>

                <section id="standard-json-output" className="mb-8 page-section">
                  <LazyJsonSection
                    field="stdJsonOutput"
                    chainId={chainId}
                    address={contractWithPlaceholders.address}
                    serverUrl={getSourcifyServerUrl()}
                    fileName="standard-json-output"
                    header={
                      <>
                        <h2 className="text-xl font-semibold text-gray-800">Standard JSON Output</h2>
                        <p className="text-gray-700 text-sm">
                          This isn&apos;t the original compiler JSON data. Generated for compatibility.
                        </p>
                      </>
                    }
                  />
                </section>
              </div>
            </div>
          </>
        }
        readWrite={
          showInteraction ? (
            <section id="interact" className="mb-8 page-section">
              <Interaction
                chainId={chainId}
                chainName={chainName}
                address={contract.address}
                contractName={contract.compilation.name}
                abi={(contract.abi ?? []) as unknown as AbiEntry[]}
                userdoc={contract.userdoc}
                devdoc={contract.devdoc}
                proxy={{
                  isProxy: !!contract.proxyResolution?.isProxy,
                  heuristic: isHeuristicProxyResolution(contract.proxyResolution?.proxyType),
                  implementation: contract.proxyResolution?.isProxy
                    ? contract.proxyResolution.implementations[0]
                    : undefined,
                  implementationCount: contract.proxyResolution?.isProxy
                    ? contract.proxyResolution.implementations.length
                    : 0,
                }}
                serverUrl={getSourcifyServerUrl()}
                warnings={[
                  ...(!contract.creationMatch && contract.runtimeMatch
                    ? [
                        "This contract is matched only with its runtime bytecode. The constructor may differ from this source.",
                      ]
                    : []),
                  ...(hasUnverifiedLibraries
                    ? ["This contract uses libraries that are not verified. They can contain any code."]
                    : []),
                ]}
              />
            </section>
          ) : null
        }
      />
    </div>
  );
}
