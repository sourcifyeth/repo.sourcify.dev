"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChainData } from "@/types/chain";
import ChainSelect from "./ChainSelect";
import { isAddress } from "@ethersproject/address";
import TopContracts from "./TopContracts";
import ExampleContracts from "./ExampleContracts";

interface HomeFormProps {
  chains: ChainData[];
}

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

  return (
    <>
      <form className="mt-4 md:mt-8 space-y-6 w-full max-w-xl mx-auto mb-10" onSubmit={handleSubmit}>
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
          <ExampleContracts chains={chains} />
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm h-full">
          <TopContracts />
        </div>
      </div>
    </>
  );
}
