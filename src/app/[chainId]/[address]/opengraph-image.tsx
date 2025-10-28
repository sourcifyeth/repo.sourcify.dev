import { ImageResponse } from "next/og";
import { getChainName } from "@/utils/api";
import { fetchContractData } from "@/utils/fetch-contract-data";
import { fetchChains } from "@/utils/fetch-chains";

export const runtime = "edge";

export const alt = "Sourcify Contract Viewer";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: { chainId: string; address: string };
}) {
  const { chainId, address } = params;

  let contractName = "Contract";
  let chainName = `Chain ${chainId}`;

  try {
    // Fetch data in parallel
    const [contract, chains] = await Promise.all([
      fetchContractData(chainId, address),
      fetchChains(),
    ]);

    contractName = contract.compilation.name || "Contract";
    chainName = getChainName(chainId, chains);
  } catch {
    // Use default names if data fetching fails
    try {
      // Try to at least get the chain name
      const chains = await fetchChains();
      chainName = getChainName(chainId, chains);
    } catch {
      // Use default chain name if chains data fails
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          fontSize: 60,
          color: "white",
          background: "linear-gradient(to bottom right, #3b82f6, #1e40af)",
          width: "100%",
          height: "100%",
          padding: "50px 200px",
          textAlign: "center",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.8 }}>
          Sourcify Contract Viewer
        </div>
        <div style={{ fontSize: 70, fontWeight: "bold", marginTop: 20 }}>
          {contractName}
        </div>
        <div style={{ fontSize: 30, marginTop: 20, fontFamily: "monospace" }}>
          {address}
        </div>
        <div style={{ fontSize: 30, marginTop: 10 }}>{chainName}</div>
      </div>
    ),
    {
      ...size,
    }
  );
}
