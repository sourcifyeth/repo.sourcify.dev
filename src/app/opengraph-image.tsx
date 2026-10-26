import { ImageResponse } from "next/og";

// The default social preview image. Contract pages have their own (see [chainId]/[address]).

export const runtime = "edge";

export const alt = "repo.sourcify.dev: verified smart contracts on Sourcify";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const loadAsset = (url: URL) => fetch(url).then((res) => res.arrayBuffer());

export default async function Image() {
  const [logo, sans, sansSemiBold, vt323] = await Promise.all([
    loadAsset(new URL("../../public/sourcify.png", import.meta.url)),
    loadAsset(new URL("../assets/fonts/ibm-plex-sans-latin-400-normal.woff", import.meta.url)),
    loadAsset(new URL("../assets/fonts/ibm-plex-sans-latin-600-normal.woff", import.meta.url)),
    loadAsset(new URL("../assets/fonts/vt323-latin-400-normal.woff", import.meta.url)),
  ]);

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
        <div style={{ display: "flex", width: 18, height: "100%", background: "#2B50AA" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: 72 }}>
          <img alt="Sourcify logo" src={logo as unknown as string} width={120} height={120} />
          <div style={{ display: "flex", marginTop: 28, fontSize: 112, fontFamily: "VT323", color: "#111827" }}>
            repo.sourcify.dev
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 38, color: "#4b5563", maxWidth: 960 }}>
            Source code, ABI and bytecode of smart contracts verified on Sourcify
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "IBM Plex Sans", data: sans, weight: 400, style: "normal" },
        { name: "IBM Plex Sans", data: sansSemiBold, weight: 600, style: "normal" },
        { name: "VT323", data: vt323, weight: 400, style: "normal" },
      ],
    }
  );
}
