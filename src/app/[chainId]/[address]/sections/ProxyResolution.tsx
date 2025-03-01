import { ContractData } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";

interface ProxyResolutionProps {
  proxyResolution: ContractData["proxyResolution"];
}

// Helper component for implementation items
interface ImplementationItemProps {
  address: string;
  name?: string;
  index: number;
}

const ImplementationItem = ({ address, name, index }: ImplementationItemProps) => {
  return (
    <div className="mt-2 first:mt-0">
      <span className="font-mono inline-flex items-center">
        {address}
        <CopyToClipboard text={address} className="ml-2" />
      </span>
      {name && <span className="ml-2 text-gray-500">({name})</span>}
    </div>
  );
};

export default function ProxyResolution({ proxyResolution }: ProxyResolutionProps) {
  if (!proxyResolution) return null;

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
                      <ImplementationItem address={impl.address} name={impl.name} index={index} />
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
