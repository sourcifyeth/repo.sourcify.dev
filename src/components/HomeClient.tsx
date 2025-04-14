"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChainData } from "@/types/chain";

interface HomeClientProps {
  chains: ChainData[];
}

export default function HomeClient({ chains }: HomeClientProps) {
  const router = useRouter();
  const [chainId, setChainId] = useState("1");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!address) {
      setError("Please enter a contract address");
      return;
    }

    // Clear any previous errors
    setError(null);

    // Navigate to the contract page
    router.push(`/${chainId}/${address}`);
  };

  // Filter chains to only show supported ones
  const supportedChains = chains.filter((chain) => chain.supported);

  return (
    <>
      <form className="mt-8 space-y-6 w-full max-w-xl mx-auto" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="chainId" className="block text-lg font-medium text-gray-700">
              Chain
            </label>
            <select
              id="chainId"
              name="chainId"
              className="mt-1 block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 border-cerulean-blue-300 hover:border-cerulean-blue-400 rounded-md cursor-pointer text-cerulean-blue-600"
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
            >
              {supportedChains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId.toString()}>
                  {chain.name} ({chain.chainId})
                </option>
              ))}
            </select>
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
                className="mt-1 block w-full pl-3 pr-10 py-3 text-base bg-cerulean-blue-100 border-2 border-cerulean-blue-300 hover:border-cerulean-blue-400 rounded-md text-cerulean-blue-600"
                placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md font-medium text-white bg-cerulean-blue hover:bg-cerulean-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cerulean-blue-500 cursor-pointer"
          >
            View Contract
          </button>
        </div>
      </form>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      <div className="mt-8">
        <h4 className="text-md font-medium text-gray-700">Example Contracts</h4>
        <ul className="mt-2 space-y-2 text-sm text-gray-600">
          <li>
            <button
              className="text-blue-600 hover:text-blue-800"
              onClick={() => {
                setChainId("1");
                setAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
                router.push("/1/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
              }}
            >
              USDC Proxy (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
            </button>
          </li>
          <li>
            <button
              className="text-blue-600 hover:text-blue-800"
              onClick={() => {
                setChainId("1");
                setAddress("0x6B175474E89094C44Da98b954EedeAC495271d0F");
                router.push("/1/0x6B175474E89094C44Da98b954EedeAC495271d0F");
              }}
            >
              DAI (0x6B175474E89094C44Da98b954EedeAC495271d0F)
            </button>
          </li>
          <li>
            <button
              className="text-blue-600 hover:text-blue-800"
              onClick={() => {
                setChainId("100");
                setAddress("0x6018F5a151d43a8Da47829d329fa7D8C4dBa79db");
                router.push("/10/0x6018F5a151d43a8Da47829d329fa7D8C4dBa79db");
              }}
            >
              ERC721 on Optimism (10) (0x6018F5a151d43a8Da47829d329fa7D8C4dBa79db)
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
