"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChainData } from "@/types/chain";
import ChainSelect from "./ChainSelect";
import { isAddress } from "@ethersproject/address";
import { getChainName } from "@/utils/api";

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
      <form className="mt-8 space-y-6 w-full max-w-xl mx-auto" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="chainId" className="block text-lg font-medium text-gray-700">
              Chain
            </label>
            <ChainSelect
              value={chainId}
              handleChainIdChange={(value: string | string[]) => setChainId(value as string)}
              chains={chains}
              className="mt-1 block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 border-cerulean-blue-300 hover:border-cerulean-blue-400 rounded-md cursor-pointer text-cerulean-blue-600"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-lg font-medium text-gray-700">
              Address
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                name="address"
                id="address"
                className={`mt-1 block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 ${
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

      <div className="mt-8">
        <h4 className="text-md font-medium text-gray-700">Example Contracts</h4>
        <ul className="mt-2 space-y-2 text-sm text-gray-600">
          {EXAMPLE_CONTRACTS.map((contract) => (
            <li key={contract.address}>
              <button
                className="text-blue-600 hover:text-blue-800 cursor-pointer"
                onClick={() => handleExampleClick(contract)}
              >
                {contract.name} on {getChainName(contract.chainId, chains)} ({contract.address})
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
