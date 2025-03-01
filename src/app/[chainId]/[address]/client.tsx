"use client";

import { ContractData } from "@/types/contract";
import ContractAbi from "@/app/[chainId]/[address]/sections/ContractAbi";
import ContractSource from "@/app/[chainId]/[address]/sections/ContractSource";
import ContractBytecode from "@/app/[chainId]/[address]/sections/ContractBytecode";

interface ContractPageClientProps {
  contract: ContractData;
}

export default function ContractPageClient({ contract }: ContractPageClientProps) {
  return (
    <>
      {/* Contract ABI Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">ABI</h2>
        <ContractAbi abi={contract.abi} />
      </section>

      {/* Contract Source Code Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Source Code</h2>
        <ContractSource contract={contract} />
      </section>

      {/* Contract Bytecode Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Bytecode</h2>
        <ContractBytecode contract={contract} />
      </section>
    </>
  );
}
