"use client";


interface ExampleContract {
  name: string;
  address: string;
  chainId: string;
}

interface ExampleContractsProps {
  /** Called with the address of the chip that the user clicked */
  onPick: (address: string) => void;
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

// Phones show only this many chips, so the row stays short
const MOBILE_CHIP_COUNT = 4;

// A row of chips under the search. A click fills the search with the address, so the user sees the chain list.
export default function ExampleContracts({ onPick }: ExampleContractsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <span className="text-gray-500">Try:</span>
      {EXAMPLE_CONTRACTS.map((contract, index) => (
        <button
          key={contract.address}
          type="button"
          onClick={() => onPick(contract.address)}
          className={`${index >= MOBILE_CHIP_COUNT ? "hidden sm:inline-block" : ""} px-2.5 py-1 rounded-full border border-cerulean-blue-200 bg-white text-cerulean-blue-600 hover:bg-cerulean-blue-100 cursor-pointer`}
        >
          {contract.name}
        </button>
      ))}
    </div>
  );
}
