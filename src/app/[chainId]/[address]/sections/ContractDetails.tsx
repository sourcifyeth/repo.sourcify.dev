import { ContractData } from "@/types/contract";
import { formatTimestamp } from "@/utils/api";
import CopyToClipboard from "../../../../components/CopyToClipboard";

interface ContractDetailsProps {
  contract: ContractData;
  chainName: string;
}

// Helper component for detail rows
interface DetailRowProps {
  label: string;
  value: string;
  isEven: boolean;
  copyValue?: string;
}

const DetailRow = ({ label, value, isEven, copyValue }: DetailRowProps) => {
  const bgColor = isEven ? "bg-gray-50" : "bg-white";

  return (
    <div className={`${bgColor} px-4 py-3 md:grid md:grid-cols-[150px_1fr] md:gap-4 md:px-6 md:items-center`}>
      <dt className="font-bold text-gray-900 mb-1 sm:mb-0">{label}</dt>
      <dd className="text-gray-900">
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

export default function ContractDetails({ contract }: ContractDetailsProps) {
  // Create an array of details to render
  const details = [
    { label: "Contract Name", value: contract.compilation.name },
    { label: "Compilation Target", value: contract.compilation.fullyQualifiedName },
    { label: "Language", value: contract.compilation.language },
    { label: "Compiler", value: `${contract.compilation.compiler} ${contract.compilation.compilerVersion}` },
    { label: "EVM Version", value: contract.compilation.compilerSettings.evmVersion },
    { label: "Verified At", value: formatTimestamp(contract.verifiedAt) },
    { label: "Deployer", value: contract.deployment.deployer, copyValue: contract.deployment.deployer },
    {
      label: "Deployment Transaction",
      value: contract.deployment.transactionHash,
      copyValue: contract.deployment.transactionHash,
    },
    { label: "Block Number", value: contract.deployment.blockNumber },
    { label: "Transaction Index ", value: contract.deployment.transactionIndex },
  ];

  return (
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
  );
}
