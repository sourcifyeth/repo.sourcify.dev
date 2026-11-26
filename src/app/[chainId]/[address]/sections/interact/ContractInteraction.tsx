"use client";

import { SourcesProvider } from "./DataSources";
import FunctionList from "./FunctionList";
import type { ContractInteractionProps } from "./useContractFunctions";
import { WalletProvider } from "./Wallet";

/**
 * The "Read / Write Contract" section: the functions of the verified ABI, with read calls to two public
 * RPC endpoints and writes from the user's browser wallet. Loaded only in the browser (see Interaction.tsx).
 */
export default function ContractInteraction(props: ContractInteractionProps) {
  return (
    <SourcesProvider chainId={props.chainId}>
      <WalletProvider chainId={props.chainId}>
        <FunctionList {...props} />
      </WalletProvider>
    </SourcesProvider>
  );
}
