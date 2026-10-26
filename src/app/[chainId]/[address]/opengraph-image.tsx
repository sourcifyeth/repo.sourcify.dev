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

// The icons of the match badge in the page header (react-icons io5 IoCheckmarkDoneCircle and
// IoCheckmarkCircle). The image renderer can't run react-icons, so the paths are copied here.
const EXACT_MATCH_ICON =
  "M258.9 48C141.92 46.42 46.42 141.92 48 258.9c1.56 112.19 92.91 203.54 205.1 205.1 117 1.6 212.48-93.9 210.88-210.88C462.44 140.91 371.09 49.56 258.9 48m-16.79 192.47 51.55-59a16 16 0 0 1 24.1 21.06l-51.55 59a16 16 0 1 1-24.1-21.06m-38.86 90.85a16 16 0 0 1-22.62 0l-47.95-48a16 16 0 1 1 22.64-22.62l48 48a16 16 0 0 1-.07 22.62m176.8-128.79-111.88 128a16 16 0 0 1-11.51 5.47h-.54a16 16 0 0 1-11.32-4.69l-47.94-48a16 16 0 1 1 22.64-22.62l29.8 29.83a8 8 0 0 0 11.68-.39l95-108.66a16 16 0 0 1 24.1 21.06z";
const MATCH_ICON =
  "M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48m108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58";

// Pills share one look; the match badge only changes the colors (the header's green-100/200/800)
const pill = {
  display: "flex",
  alignItems: "center",
  height: 60,
  padding: "0 20px",
  borderRadius: 11,
  border: "2px solid #e5e7eb",
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 30,
} as const;

function MatchBadge({ summary }: { summary: ContractSummary | null | undefined }) {
  // undefined: the contract could not be fetched, so show no status at all
  if (summary === undefined) return null;

  if (summary === null || !summary.match) {
    return <div style={{ ...pill, color: "#4b5563" }}>Not verified on Sourcify</div>;
  }

  const exact = summary.match === "exact_match";
  return (
    <div
      style={{ ...pill, gap: 8, background: "#dcfce7", border: "2px solid #bbf7d0", color: "#166534", fontWeight: 600 }}
    >
      <svg width="42" height="42" viewBox="0 0 512 512" fill="#166534">
        <path d={exact ? EXACT_MATCH_ICON : MATCH_ICON} />
      </svg>
      {exact ? "Exact Match" : "Match"}
    </div>
  );
}

// The language logos of LanguageIcon.tsx, with the same scale (the Solidity file has a wide margin)
const LANGUAGE_LOGOS: Record<string, { file: URL; scale: number }> = {
  solidity: { file: new URL("../../../assets/solidity.svg", import.meta.url), scale: 1.5 },
  vyper: { file: new URL("../../../assets/vyper.svg", import.meta.url), scale: 1 },
  fe: { file: new URL("../../../assets/fe-dark.svg", import.meta.url), scale: 1 },
};

async function loadLanguageLogo(language: string | undefined) {
  const logo = language && LANGUAGE_LOGOS[language.toLowerCase()];
  if (!logo) return null;
  const svg = await fetch(logo.file).then((res) => res.text());
  return { src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, scale: logo.scale };
}

export default async function Image({ params }: { params: { chainId: string; address: string } }) {
  const { chainId, address } = params;

  const summaryPromise = fetchContractSummary(chainId, address).catch(() => undefined);
  const [summary, languageLogo, chainName, logo, sans, sansSemiBold, mono, vt323] = await Promise.all([
    summaryPromise,
    summaryPromise.then((summary) => loadLanguageLogo(summary?.compilation.language)).catch(() => null),
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
  const compilation = summary?.compilation;
  const compilerVersion = compilation?.compilerVersion?.split("+")[0];

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

          {/* Status, language and compiler, like the page header and the Compilation card */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <MatchBadge summary={summary} />
            {compilation?.language && (
              <div style={{ ...pill, gap: 12 }}>
                {languageLogo && (
                  <div style={{ display: "flex", width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                    <img
                      alt=""
                      src={languageLogo.src}
                      width={Math.round(34 * languageLogo.scale)}
                      height={Math.round(34 * languageLogo.scale)}
                    />
                  </div>
                )}
                {compilation.language}
              </div>
            )}
            {compilation?.compiler && compilerVersion && (
              <div style={pill}>
                {compilation.compiler} {compilerVersion}
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
