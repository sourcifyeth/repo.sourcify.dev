"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChainData } from "@/types/chain";
import ChainSelect from "./ChainSelect";
import { isAddress } from "@ethersproject/address";
import { getChainName } from "@/utils/api";
import TopContracts from "./TopContracts";
import { FaCheckCircle } from "react-icons/fa";

interface HomeFormProps {
  chains: ChainData[];
}

interface ExampleContract {
  name: string;
  address: string;
  chainId: string;
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

export default function HomeForm({ chains }: HomeFormProps) {
  const router = useRouter();
  const [chainId, setChainId] = useState("1");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAddressValid = address && isAddress(address);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Please enter a contract address");
      return;
    }

    if (!isAddress(address)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    setError(null);
    router.push(`/${chainId}/${address}`);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setAddress(value);

    if (value && !isAddress(value)) {
      setError("Please enter a valid Ethereum address");
    } else {
      // Add '0x' prefix if not present. Ethers.js accepts with and without it.
      if (value && !value.startsWith("0x")) {
        setAddress("0x" + value);
      }
      setError(null);
    }
  };

  const handleExampleClick = (contract: ExampleContract) => {
    setChainId(contract.chainId);
    setAddress(contract.address);
    setError(null);
    router.push(`/${contract.chainId}/${contract.address}`);
  };

  return (
    <>
      <form className="mt-8 space-y-6 w-full max-w-xl mx-auto mb-10" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="chainId" className="block text-lg font-medium text-gray-700 mb-1">
              Chain
            </label>
            <ChainSelect
              value={chainId}
              handleChainIdChange={(value: string | string[]) => setChainId(value as string)}
              chains={chains}
              className="block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 border-cerulean-blue-300 hover:border-cerulean-blue-400 rounded-md cursor-pointer text-cerulean-blue-600"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-lg font-medium text-gray-700 mb-1">
              Address
            </label>
            <div className="flex rounded-md shadow-sm">
              <input
                type="text"
                name="address"
                id="address"
                className={`block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 ${
                  error ? "border-red-500" : "border-cerulean-blue-300 hover:border-cerulean-blue-400"
                } rounded-md text-cerulean-blue-600`}
                placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
                value={address}
                onChange={handleAddressChange}
              />
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={!isAddressValid}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md font-medium text-white ${
              isAddressValid
                ? "bg-cerulean-blue hover:bg-cerulean-blue-600 cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cerulean-blue-500`}
          >
            View Contract
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm h-full">
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
                    onClick={() => handleExampleClick(contract)}
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
                      <div className="text-xs text-gray-500 font-normal">
                        on {getChainName(contract.chainId, chains)}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 text-left">{contract.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm h-full">
          <TopContracts />
        </div>
      </div>
    </>
  );
}
