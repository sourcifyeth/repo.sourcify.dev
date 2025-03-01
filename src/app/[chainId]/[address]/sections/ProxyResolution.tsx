import { ContractData } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";
import InfoTooltip from "@/components/InfoTooltip";
import Link from "next/link";

interface ProxyResolutionProps {
  proxyResolution: ContractData["proxyResolution"];
  chainId: string;
}

// Type for verification response
interface VerificationResponse {
  match: string | null;
  creationMatch: string | null;
  runtimeMatch: string | null;
  chainId: string;
  address: string;
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
  // Create shortened address display
  const shortenedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

  // Create the address display component that will be used in both cases
  const addressDisplay = (
    <span className="font-mono inline-flex items-center">
      {address}
      <CopyToClipboard text={address} className="ml-2" />
    </span>
  );

  return (
    <div className="mt-2 first:mt-0 flex items-center">
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
            <IoCheckmarkCircle className="text-green-500 text-xl" />
            <InfoTooltip
              content={`Implementation <span style="word-break: break-all;">${shortenedAddress}</span> verified on Sourcify`}
              className="ml-1"
              html={true}
            />
          </div>
        ) : (
          <div className="flex items-center">
            <IoCloseCircle className="text-red-500 text-xl" />
            <InfoTooltip
              content={`Implementation <span style="word-break: break-all;">${shortenedAddress}</span> not verified on Sourcify`}
              className="ml-1"
              html={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Server-side function to check if a contract is verified
async function checkVerification(chainId: string, address: string): Promise<boolean> {
  try {
    // Determine environment based on NODE_ENV
    const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === "staging";
    const baseUrl = isStaging ? "https://staging.sourcify.dev/server/v2" : "https://sourcify.dev/server/v2";

    const url = `${baseUrl}/contract/${chainId}/${address}`;
    const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour
    const data = (await response.json()) as VerificationResponse;

    // Check if the contract is verified (match field is not null)
    return data.match !== null;
  } catch (error) {
    console.error("Error checking implementation verification:", error);
    return false;
  }
}

export default async function ProxyResolution({ proxyResolution, chainId }: ProxyResolutionProps) {
  if (!proxyResolution) return null;

  // Fetch verification status for all implementations in parallel
  const verificationPromises = proxyResolution.implementations.map((impl) => checkVerification(chainId, impl.address));

  const verificationResults = await Promise.all(verificationPromises);

  return (
    <div className="mt-1">
      <p className="text-sm text-gray-500">This contract is a {proxyResolution.proxyType} proxy</p>
      <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-3 md:grid md:grid-cols-[150px_1fr] md:gap-4 md:px-6 md:items-center">
              <dt className="text-sm font-bold text-gray-900 mb-1 md:mb-0">Proxy Type</dt>
              <dd className="text-sm text-gray-900">{proxyResolution.proxyType}</dd>
            </div>

            <div className="bg-white px-4 py-3 grid grid-cols-1 gap-4 md:px-6">
              <div className="font-bold text-gray-900">Implementations</div>
              {proxyResolution.implementations.map((impl, index) => (
                <div key={index} className="md:grid md:grid-cols-[150px_1fr] md:gap-4 md:items-center ml-4">
                  <dt className="text-sm font-bold text-gray-900 mb-1 md:mb-0">Implementation {index + 1}</dt>
                  <dd className="text-sm text-gray-900">
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
    </div>
  );
}
