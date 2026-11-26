import type { Metadata } from "next";
import ContractView, { contractMetadata } from "./ContractView";

type Params = { params: Promise<{ chainId: string; address: string }> };

export function generateMetadata({ params }: Params): Promise<Metadata> {
  return contractMetadata({ params });
}

/** The "Code" tab of a contract (the verification page). */
export default function ContractPage({ params }: Params) {
  return <ContractView params={params} tab="code" />;
}
