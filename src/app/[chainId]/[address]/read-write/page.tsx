import type { Metadata } from "next";
import ContractView, { contractMetadata } from "../ContractView";

type Params = { params: Promise<{ chainId: string; address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const metadata = await contractMetadata({ params });
  return { ...metadata, title: metadata.title ? `Read/Write Contract · ${metadata.title}` : "Read/Write Contract" };
}

/** The "Read/Write Contract" tab of a contract: the same page as "Code", with this tab open. */
export default function ReadWritePage({ params }: Params) {
  return <ContractView params={params} tab="read-write" />;
}
