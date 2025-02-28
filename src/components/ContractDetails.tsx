import { ContractData } from "@/types/contract";
import { formatTimestamp } from "@/utils/api";
import CopyToClipboard from "./CopyToClipboard";

interface ContractDetailsProps {
  contract: ContractData;
  chainName: string;
}

export default function ContractDetails({ contract, chainName }: ContractDetailsProps) {
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Contract Address</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono flex items-center">
              {contract.address}
              <CopyToClipboard text={contract.address} className="ml-2" />
            </dd>
          </div>
          <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Chain</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{chainName}</dd>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Match Type</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{contract.match}</dd>
          </div>
          <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Verified At</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{formatTimestamp(contract.verifiedAt)}</dd>
          </div>
          {contract.deployment && (
            <>
              <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Deployer</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono flex items-center">
                  {contract.deployment.deployer}
                  <CopyToClipboard text={contract.deployment.deployer} className="ml-2" />
                </dd>
              </div>
              <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Transaction Hash</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono flex items-center">
                  {contract.deployment.transactionHash}
                  <CopyToClipboard text={contract.deployment.transactionHash} className="ml-2" />
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Block Number</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{contract.deployment.blockNumber}</dd>
              </div>
            </>
          )}
          <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Compiler</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {contract.compilation.compiler} {contract.compilation.compilerVersion}
            </dd>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Language</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{contract.compilation.language}</dd>
          </div>
          {contract.proxyResolution && (
            <div className="bg-white px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Proxy Type</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {contract.proxyResolution.proxyType}
                {contract.proxyResolution.implementations.map((impl, index) => (
                  <div key={index} className="mt-2">
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
          )}
        </dl>
      </div>
    </div>
  );
}
