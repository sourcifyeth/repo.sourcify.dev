import { ContractData } from "@/types/contract";
import { formatTimestamp } from "@/utils/api";
import CopyToClipboard from "./CopyToClipboard";
import ProxyResolution from "./ProxyResolution";

interface ContractDetailsProps {
  contract: ContractData;
  chainName: string;
}

// Helper component for detail rows
interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  isEven: boolean;
  copyValue?: string;
}

const DetailRow = ({ label, value, isEven, copyValue }: DetailRowProps) => {
  const bgColor = isEven ? "bg-gray-50" : "bg-white";

  return (
    <div className={`${bgColor} px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
        {copyValue ? (
          <div className="font-mono flex items-center">
            {value}
            <CopyToClipboard text={copyValue} className="ml-2" />
          </div>
        ) : (
          value
        )}
      </dd>
    </div>
  );
};

export default function ContractDetails({ contract, chainName }: ContractDetailsProps) {
  // Create an array of details to render
  const details = [
    { label: "Contract Address", value: contract.address, copyValue: contract.address },
    { label: "Chain", value: chainName },
    { label: "Match Type", value: contract.match },
    { label: "Verified At", value: formatTimestamp(contract.verifiedAt) },
  ];

  // Add deployment details if available
  if (contract.deployment) {
    details.push(
      { label: "Deployer", value: contract.deployment.deployer, copyValue: contract.deployment.deployer },
      {
        label: "Transaction Hash",
        value: contract.deployment.transactionHash,
        copyValue: contract.deployment.transactionHash,
      },
      { label: "Block Number", value: contract.deployment.blockNumber }
    );
  }

  // Add compilation details
  details.push(
    { label: "Compiler", value: `${contract.compilation.compiler} ${contract.compilation.compilerVersion}` },
    { label: "Language", value: contract.compilation.language }
  );

  return (
    <>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="border-t border-gray-200">
          <dl>
            {details.map((detail, index) => (
              <DetailRow
                key={detail.label}
                label={detail.label}
                value={detail.value}
                isEven={index % 2 === 0}
                copyValue={detail.copyValue}
              />
            ))}
          </dl>
        </div>
      </div>

      {/* Render proxy resolution component if available */}
      {contract.proxyResolution && <ProxyResolution proxyResolution={contract.proxyResolution} />}
    </>
  );
}
