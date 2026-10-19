import HomeForm from "@/components/HomeForm";
import TopContracts from "@/components/TopContracts";
import LiveVerifications from "@/components/LiveVerifications";
import { fetchChains, fetchVerifiedContractsTotal, getSourcifyServerUrl } from "@/utils/api";

// Force dynamic rendering to avoid passing SOURCIFY_SERVER_URL env var as a build arg
export const dynamic = "force-dynamic";

export default async function Home() {
  const [chains, verifiedTotal] = await Promise.all([fetchChains(), fetchVerifiedContractsTotal()]);
  const serverUrl = getSourcifyServerUrl();
  // The live stream sits next to the server, e.g. https://sourcify.dev/server -> https://sourcify.dev/live/stream
  const liveStreamUrl = `${new URL(serverUrl).origin}/live/stream`;

  return (
    <div className="w-full mx-auto">
      <div className="md:px-4 py-5 md:p-6 text-center">
        {/* Hidden visually; kept for screen readers and search engines */}
        <h1 className="sr-only">Sourcify Verified Contract Repository</h1>
        <HomeForm chains={chains} serverUrl={serverUrl} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 pt-5 rounded-lg shadow-sm h-full flex flex-col">
            <LiveVerifications streamUrl={liveStreamUrl} initialTotal={verifiedTotal} chains={chains} />
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm h-full">
            <TopContracts />
          </div>
        </div>
      </div>
    </div>
  );
}
