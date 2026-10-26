import { ImageResponse } from "next/og";
import { fetchContractSummary, fetchChains, getChainName, ContractSummary } from "@/utils/api";

// The social preview image (og:image and twitter:image) of a contract page.
// Next.js renders it on request, one image per contract URL.

export const runtime = "edge";

export const alt = "Verified contract on Sourcify";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const BRAND_BLUE = "#2B50AA";

const loadAsset = (url: URL) => fetch(url).then((res) => res.arrayBuffer());

// Smaller text for longer names, so most names fit on one line
function nameFontSize(name: string) {
  if (name.length <= 16) return 96;
  if (name.length <= 22) return 80;
  if (name.length <= 30) return 64;
  return 52;
}

function CheckIcon({ double }: { double: boolean }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round">
      {/* The image renderer allows only plain elements inside <svg>, so no fragment here */}
      <path d={double ? "M2 12.5l4.5 4.5L16 7.5M11.5 16l1 1L22 7.5" : "M4.5 12.5l5 5L19.5 7"} />
    </svg>
  );
}

function Badge({ summary }: { summary: ContractSummary | null | undefined }) {
  // undefined: the contract could not be fetched, so show no status at all
  if (summary === undefined) return null;

  if (summary === null || !summary.match) {
    return (
      <div
        style={{
          display: "flex",
          padding: "10px 22px",
          borderRadius: 12,
          background: "#f3f4f6",
          border: "2px solid #e5e7eb",
          color: "#4b5563",
          fontSize: 30,
        }}
      >
        Not verified on Sourcify
      </div>
    );
  }

  const exact = summary.match === "exact_match";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 22px",
        borderRadius: 12,
        background: "#dcfce7",
        border: "2px solid #bbf7d0",
        color: "#166534",
        fontSize: 30,
        fontWeight: 600,
      }}
    >
      <CheckIcon double={exact} />
      {exact ? "Exact Match" : "Match"}
    </div>
  );
}

export default async function Image({ params }: { params: { chainId: string; address: string } }) {
  const { chainId, address } = params;

  const [summary, chainName, logo, sans, sansSemiBold, mono, vt323] = await Promise.all([
    fetchContractSummary(chainId, address).catch(() => undefined),
    fetchChains()
      .then((chains) => getChainName(chainId, chains))
      .catch(() => `Chain ${chainId}`),
    loadAsset(new URL("../../../../public/sourcify.png", import.meta.url)),
    loadAsset(new URL("../../../assets/fonts/ibm-plex-sans-latin-400-normal.woff", import.meta.url)),
    loadAsset(new URL("../../../assets/fonts/ibm-plex-sans-latin-600-normal.woff", import.meta.url)),
    loadAsset(new URL("../../../assets/fonts/ibm-plex-mono-latin-400-normal.woff", import.meta.url)),
    loadAsset(new URL("../../../assets/fonts/vt323-latin-400-normal.woff", import.meta.url)),
  ]);

  const name = summary === null ? "Unverified contract" : summary?.compilation.name || "Contract";
  const compilerVersion = summary?.compilation.compilerVersion?.split("+")[0];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #ffffff 0%, #ffffff 55%, #eef2fb 100%)",
          fontFamily: "IBM Plex Sans",
        }}
      >
        <div style={{ display: "flex", width: 18, height: "100%", background: BRAND_BLUE }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "60px 72px 64px 72px" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img alt="Sourcify logo" src={logo as unknown as string} width={60} height={60} />
            {/* The site name in VT323, like the site header */}
            <div style={{ display: "flex", fontSize: 48, fontFamily: "VT323", color: "#374151" }}>repo.sourcify.dev</div>
          </div>

          {/* Contract */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: "auto" }}>
            <div
              style={{
                display: "block",
                fontSize: nameFontSize(name),
                fontWeight: 600,
                color: "#111827",
                lineHeight: 1.1,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                maxWidth: 1030,
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 34, fontFamily: "IBM Plex Mono", color: "#374151" }}>
              {address}
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 32, color: "#6b7280" }}>on {chainName}</div>
          </div>

          {/* Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Badge summary={summary} />
            {summary?.compilation.language && (
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 12,
                  background: "#f3f4f6",
                  border: "2px solid #e5e7eb",
                  color: "#374151",
                  fontSize: 30,
                }}
              >
                {summary.compilation.language} {compilerVersion}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "IBM Plex Sans", data: sans, weight: 400, style: "normal" },
        { name: "IBM Plex Sans", data: sansSemiBold, weight: 600, style: "normal" },
        { name: "IBM Plex Mono", data: mono, weight: 400, style: "normal" },
        { name: "VT323", data: vt323, weight: 400, style: "normal" },
      ],
    }
  );
}
