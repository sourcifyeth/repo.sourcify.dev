"use client";

import dynamic from "next/dynamic";
import LoadingState from "@/components/LoadingState";
import type { ContractInteractionProps } from "./useContractFunctions";

/**
 * Loads the section's code (with viem) only in the browser, on the "Read/Write Contract" tab.
 * The "Code" tab does not load it.
 */
const ContractInteraction = dynamic(() => import("./ContractInteraction"), {
  ssr: false,
  loading: () => <LoadingState />,
});

export default function Interaction(props: ContractInteractionProps) {
  return <ContractInteraction {...props} />;
}
