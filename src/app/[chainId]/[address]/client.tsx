"use client";

import { ContractData } from "@/types/contract";
import ContractDetails from "@/components/ContractDetails";
import ContractAbi from "@/components/ContractAbi";
import ContractSource from "@/components/ContractSource";
import ContractBytecode from "@/components/ContractBytecode";

interface ContractPageClientProps {
  contract: ContractData;
  chainName: string;
}

export default function ContractPageClient({ contract, chainName }: ContractPageClientProps) {
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
