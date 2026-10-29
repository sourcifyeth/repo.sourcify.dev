import { ContractData } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";
import InfoTooltip from "@/components/InfoTooltip";
import Link from "next/link";
import { checkVerification } from "@/utils/api";

/**
 * Whether the implementation address comes from values that the contract controls (a storage slot,
 * or a function such as `implementation()`), so it is not proof of where the contract sends its calls.
 * The exception is an EIP-1167 clone: Sourcify reports this type only if the runtime bytecode starts
 * with the exact 45-byte stub, and the stub has the address inside it next to the DELEGATECALL.
 */
export function isHeuristicProxyResolution(proxyType: string | null | undefined): boolean {
  return proxyType !== "EIP1167Proxy";
}

/** The tooltip text of the "Proxy" badge in the page header. */
export function proxyBadgeTooltip(proxyResolution: NonNullable<ContractData["proxyResolution"]>): string {
  const names = (proxyResolution.implementations ?? []).map(
    (implementation) => implementation.name || implementation.address
  );
  const target = names.length ? ` for ${names.join(", ")}` : "";
  return isHeuristicProxyResolution(proxyResolution.proxyType)
    ? `This contract reports that it is a proxy${target}. Found with heuristics, not confirmed.`
    : `This contract is a proxy${target}.`;
}

const HEURISTIC_TOOLTIP = [
  "<b>How Sourcify finds the implementation</b><br/>",
  "WhatsABI looks for known proxy patterns in the bytecode. ",
  "Then Sourcify reads the implementation address from the storage of the contract, ",
  "or calls a function such as <code>implementation()</code> on the contract.<br/><br/>",
  "<b>What Sourcify does not check</b><br/>",
  "Sourcify does not check that the contract really sends its calls (DELEGATECALL) to this address. ",
  "The contract controls these values. ",
  "So a contract can show a trusted implementation and run other code.<br/><br/>",
  "<b>What you can do</b><br/>",
  "Read the fallback function in the source code of this contract. ",
  "Confirm that it delegates to the implementation address.",
].join("");

interface ProxyResolutionProps {
  proxyResolution: ContractData["proxyResolution"];
  chainId: string;
}

// Helper component for implementation items
interface ImplementationItemProps {
  address: string;
  name?: string;
  index: number;
  isVerified: boolean;
  chainId: string;
}

const ImplementationItem = ({ address, name, isVerified, chainId }: ImplementationItemProps) => {
  // Create the address display component that will be used in both cases
  const addressDisplay = (
    <span className="font-mono inline-flex items-center min-w-0">
      <span className="break-all">{address}</span>
      <CopyToClipboard text={address} className="ml-2" />
    </span>
  );

  return (
    <div className="mt-2 first:mt-0 flex flex-wrap items-center gap-y-1">
      {/* If verified, wrap in a link; otherwise just show the address */}
      {isVerified ? (
        <Link href={`/${chainId}/${address}`} className="text-blue-600 hover:underline">
          {addressDisplay}
        </Link>
      ) : (
        addressDisplay
      )}

      {name && <span className="ml-2 text-gray-500">({name})</span>}

      {/* Verification status with tooltips */}
      <div className="ml-2">
        {isVerified ? (
          <div className="flex items-center">
            <IoCheckmarkCircle className="text-green-600 text-xl" />
            <InfoTooltip
              content={`Implementation <span style="word-break: break-all;">${address}</span> verified on Sourcify`}
              className="ml-1"
              html={true}
            />
          </div>
        ) : (
          <div className="flex items-center">
            <IoCloseCircle className="text-red-600 text-xl" />
            <InfoTooltip
              content={`Implementation <span style="word-break: break-all;">${address}</span> not verified on Sourcify`}
              className="ml-1"
              html={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default async function ProxyResolution({ proxyResolution, chainId }: ProxyResolutionProps) {
  if (!proxyResolution) return null;

  // Fetch verification status for all implementations in parallel
  const verificationPromises = proxyResolution.implementations.map((impl) => checkVerification(chainId, impl.address));

  const verificationResults = await Promise.all(verificationPromises);

  const isHeuristic = isHeuristicProxyResolution(proxyResolution.proxyType);

  return (
    <div className="">
      <h2 className="md:text-xl text-lg font-semibold text-gray-800">Proxy</h2>
      <p className="text-gray-500 md:text-base text-sm">
        Proxy resolution by{" "}
        <Link
          href="https://github.com/shazow/whatsabi"
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsABI
        </Link>
      </p>

      <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg text-sm md:text-base break-all">
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-3 md:grid md:grid-cols-[150px_1fr] md:gap-4 md:px-6 md:items-center">
              <dt className="font-bold text-gray-900 mb-1 md:mb-0">Proxy Type</dt>
              <dd className="text-gray-900">{proxyResolution.proxyType}</dd>
            </div>

            <div className="bg-white px-4 py-3 grid grid-cols-1 gap-4 md:px-6">
              <div className="font-bold text-gray-900">Implementations</div>
              {proxyResolution.implementations.map((impl, index) => (
                <div key={index} className="md:grid md:grid-cols-[150px_1fr] md:gap-4 md:items-center ml-4">
                  <dt className="font-bold text-gray-900 mb-1 md:mb-0">
                    Implementation {index + 1}
                    {isHeuristic && "*"}
                  </dt>
                  <dd className="text-gray-900">
                    <div className="flex flex-col">
                      <ImplementationItem
                        address={impl.address}
                        name={impl.name}
                        index={index}
                        isVerified={verificationResults[index]}
                        chainId={chainId}
                      />
                    </div>
                  </dd>
                </div>
              ))}
            </div>
          </dl>
        </div>
      </div>

      {/* Always shown and cannot be closed: the result is a heuristic, not proof */}
      {isHeuristic && (
        <p className="mt-2 flex items-center text-xs text-gray-500 md:text-sm">
          * Reported by the contract and found with heuristics. This is not proof that the contract sends its calls
          there.
          <InfoTooltip content={HEURISTIC_TOOLTIP} html={true} className="ml-1" />
        </p>
      )}
    </div>
  );
}
