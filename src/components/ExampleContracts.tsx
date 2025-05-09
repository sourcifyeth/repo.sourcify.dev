"use client";

import { useRouter } from "next/navigation";
import { FaCheckCircle } from "react-icons/fa";
import { getChainName } from "@/utils/api";
import { ChainData } from "@/types/chain";

interface ExampleContract {
  name: string;
  address: string;
  chainId: string;
}

interface ExampleContractsProps {
  chains: ChainData[];
}

const EXAMPLE_CONTRACTS: ExampleContract[] = [
  {
    name: "ERC1967Proxy",
    address: "0x78f7C79d8aE156A6C68c67d0393d1cCc97df3Bdf",
    chainId: "1",
  },
  {
    name: "Uniswap UniversalRouter",
    address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
    chainId: "8453",
  },
  {
    name: "PendleMarketV3",
    address: "0x580E40C15261F7BAF18EA50F562118AE99361096",
    chainId: "1",
  },
  {
    name: "DAI",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    chainId: "1",
  },
  {
    name: "CreateX",
    address: "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed",
    chainId: "10",
  },
  {
    name: "1Inch AggregationRouter v5",
    address: "0x1111111254EEB25477B68fb85Ed929f73A960582",
    chainId: "8453",
  },
  {
    name: "SpaceStationV2",
    address: "0x9e6eF7F75ad88D4Edb4C9925C94B769C5b0d6281",
    chainId: "42161",
  },
  {
    name: "GovernanceToken",
    address: "0x4200000000000000000000000000000000000042",
    chainId: "10",
  },
];

export default function ExampleContracts({ chains }: ExampleContractsProps) {
  const router = useRouter();

  const handleContractClick = (contract: ExampleContract) => {
    router.push(`/${contract.chainId}/${contract.address}`);
  };

  return (
    <>
      <h4 className="text-lg font-medium text-gray-700 mb-3 text-center">Example Contracts</h4>
      <div className="max-h-[400px] overflow-auto pr-2">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th scope="col" className="pl-3 pr-1 py-2 w-6">
                {/* Empty header for consistency */}
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {EXAMPLE_CONTRACTS.map((contract) => (
              <tr
                key={contract.address}
                onClick={() => handleContractClick(contract)}
                className="cursor-pointer hover:bg-gray-50"
              >
                <td className="pl-3 pr-1 py-2 whitespace-nowrap text-sm text-gray-500 text-center w-6">
                  <FaCheckCircle
                    className="h-4 w-4 text-green-500 cursor-help"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content="Verified on Sourcify"
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-left">
                  <span className="text-blue-600 hover:underline">{contract.name}</span>
                  <div className="text-xs text-gray-500 font-normal">on {getChainName(contract.chainId, chains)}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 text-left">{contract.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
