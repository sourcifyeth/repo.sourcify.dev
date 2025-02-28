import { Metadata } from "next";
import { fetchContractData, fetchChains, getChainName } from "@/utils/api";
import { ContractData } from "@/types/contract";

export async function generateMetadata({
  params,
}: {
  params: { chainId: string; address: string };
}): Promise<Metadata> {
  const { chainId, address } = params;

  try {
    // Fetch data in parallel
    const [contract, chains] = await Promise.all([
      fetchContractData(chainId, address) as Promise<ContractData>,
      fetchChains(),
    ]);

    const contractName = contract.compilation?.name || "Contract";
    const chainName = getChainName(chainId, chains);

    return {
      title: `${contractName} | ${chainName} | Sourcify Contract Viewer`,
      description: `View verified smart contract details, ABI, source code, and bytecode for ${contractName} (${address}) on ${chainName}`,
      openGraph: {
        title: `${contractName} | ${chainName} | Sourcify Contract Viewer`,
        description: `View verified smart contract details, ABI, source code, and bytecode for ${contractName} (${address}) on ${chainName}`,
      },
      twitter: {
        title: `${contractName} | ${chainName} | Sourcify Contract Viewer`,
        description: `View verified smart contract details, ABI, source code, and bytecode for ${contractName} (${address}) on ${chainName}`,
      },
    };
  } catch {
    // Attempt to get chain name even if contract data fails
    let chainName = `Chain ${chainId}`;
    try {
      const chains = await fetchChains();
      chainName = getChainName(chainId, chains);
    } catch {
      // Use default chain name if chains data fails
    }

    return {
      title: `Contract ${address} | ${chainName} | Sourcify Contract Viewer`,
      description: `View verified smart contract details, ABI, source code, and bytecode for contract ${address} on ${chainName}`,
    };
  }
}
