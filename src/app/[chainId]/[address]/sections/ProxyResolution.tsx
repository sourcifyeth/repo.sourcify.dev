import { ContractData } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";

interface ProxyResolutionProps {
  proxyResolution: ContractData["proxyResolution"];
}

export default function ProxyResolution({ proxyResolution }: ProxyResolutionProps) {
  if (!proxyResolution) return null;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-4">
      <div className="px-4 py-5 sm:px-6 bg-blue-50">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Proxy</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">This contract is a {proxyResolution.proxyType} proxy</p>
      </div>
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Proxy Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{proxyResolution.proxyType}</dd>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Implementations</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {proxyResolution.implementations.map((impl, index) => (
                <div key={index} className="mt-2 first:mt-0">
                  <span className="font-medium">Implementation {index + 1}:</span>{" "}
                  <span className="font-mono flex items-center inline-flex">
                    {impl.address}
                    <CopyToClipboard text={impl.address} className="ml-2" />
                  </span>
                  {impl.name && <span className="ml-2 text-gray-500">({impl.name})</span>}
                </div>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
