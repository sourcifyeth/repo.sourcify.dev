import { IoCheckmarkDoneCircle, IoCheckmarkCircle, IoWarning, IoCloseCircle } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import { ChainExplorerLinks } from "@/components/ExplorerLinks";
import ContractDetails from "./sections/ContractDetails";
import { checkVerification } from "@/utils/api";
import { getAddress } from "@ethersproject/address";
import { proxyBadgeTooltip } from "@/utils/proxy";
import type { ContractPageData } from "@/types/contract";
import type { ChainData } from "@/types/chain";

// Returns the EIP-55 checksummed address, or null if the address is invalid.
// Lowercases first so any input casing is normalized to the canonical checksum
// rather than being rejected for a mismatching checksum.
export function getChecksummedAddress(address: string): string | null {
  try {
    return getAddress(address.toLowerCase());
  } catch {
    return null;
  }
}

// Chain IDs are numeric. The Sourcify server rejects anything else with a 400,
// which is a malformed URL rather than an upstream failure: treat it as not found.
export function isValidChainId(chainId: string): boolean {
  return /^\d+$/.test(chainId);
}

/** True if the page shows the "Read/Write Contract" tab: functions in the ABI, or a proxy. HIDE_CONTRACT_INTERACTION=true hides it. */
export function canInteract(contract: ContractPageData): boolean {
  return (
    process.env.HIDE_CONTRACT_INTERACTION !== "true" &&
    ((contract.abi?.length ?? 0) > 0 || !!contract.proxyResolution?.isProxy)
  );
}

/** Checks on Sourcify whether each linked library is verified. */
export async function checkLibraries(contract: ContractPageData, chainId: string) {
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

  return { verificationStatus, hasUnverifiedLibraries };
}

/**
 * The top of both contract tabs ("Code" and "Read/Write Contract"): the name, address and chain,
 * the match status, and the three cards (Contract, Compilation, Deployment).
 */
export function ContractHeader({
  contract,
  details,
  chainId,
  chainName,
  chains,
  hasUnverifiedLibraries,
  proxyHref,
}: {
  contract: ContractPageData;
  /** The contract for the cards (with library placeholders in the bytecode) */
  details: ContractPageData;
  chainId: string;
  chainName: string;
  chains: ChainData[];
  hasUnverifiedLibraries: boolean;
  /** Where the Proxy badge links to: the Proxy section of the Code tab */
  proxyHref: string;
}) {
  const isExactMatch = contract.creationMatch === "exact_match" || contract.runtimeMatch === "exact_match";
  const matchLabel = isExactMatch ? "Exact Match" : "Match";
  const matchColor = "bg-green-100 text-green-800 border-green-200";
  const matchIcon = isExactMatch ? <IoCheckmarkDoneCircle /> : <IoCheckmarkCircle />;
  const matchTooltipContent = isExactMatch
    ? "Exact match: The onchain and compiled bytecode match exactly, including the metadata hashes."
    : "Match: The onchain and compiled bytecode match, but metadata hashes differ or don't exist.";

  return (
    <>
      <div className="mt-3 mb-2">
        {/* The contract name is the title; the address and the chain follow */}
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 break-words">{contract.compilation.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center">
            <span className="text-sm break-all md:text-base font-mono text-gray-700">{contract.address}</span>
            <CopyToClipboard text={contract.address} className="ml-2 md:p-0 p-2" />
          </span>
          <ChainExplorerLinks chainId={chainId} path={`address/${contract.address}`} />
        </div>
        <p className="text-sm md:text-base text-gray-700 mt-0.5">
          on {chainName}
          {chains.find((c) => c.chainId.toString() === chainId)?.supported === false && (
            <span className="text-gray-500 text-sm ml-2"> (verification on this chain is deprecated)</span>
          )}
        </p>
      </div>

      {/* Match status */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Match badge */}
          <span
            className={`inline-flex items-center px-2 py-1 md:px-3 md:py-1 rounded-md font-semibold border ${matchColor} cursor-help text-sm w-auto flex-shrink-0 md:text-base`}
            data-tooltip-id="global-tooltip"
            data-tooltip-content={matchTooltipContent}
          >
            <span className="mr-1 text-xl md:text-2xl">{matchIcon}</span> {matchLabel}
          </span>

          {/* Bytecode match indicators */}
          <div className="flex items-center gap-2 md:text-sm text-xs text-gray-500 flex-shrink-0">
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

          {/* Proxy badge: jumps to the Proxy section */}
          {contract.proxyResolution?.isProxy && (
            <a
              href={proxyHref}
              className="inline-flex items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs md:text-sm font-medium text-purple-800 hover:bg-purple-100"
              data-tooltip-id="global-tooltip"
              data-tooltip-content={proxyBadgeTooltip(contract.proxyResolution)}
            >
              Proxy
            </a>
          )}

          {/* Unverified libraries warning */}
          {hasUnverifiedLibraries && (
            <span
              className="flex items-center gap-1 text-yellow-600 cursor-help flex-shrink-0"
              data-tooltip-id="global-tooltip"
              data-tooltip-content="This contract uses unverified libraries. Libraries can contain arbitrary code and should be verified before interacting with the contract."
            >
              <IoWarning className="h-4 w-4" />
              <span className="md:text-sm text-xs">Unverified Libraries</span>
            </span>
          )}
        </div>

        {/* Warning for runtime-only match */}
        {!contract.creationMatch && contract.runtimeMatch && (
          <div className="mt-2 md:text-sm text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 p-2 rounded">
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

      <section id="contract-details" className="my-6 page-section">
        <ContractDetails contract={details} chainId={chainId} />
      </section>
    </>
  );
}
