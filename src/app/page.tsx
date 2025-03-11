import HomeClient from "@/components/HomeClient";
import ServerNavigation from "@/components/ServerNavigation";
import { fetchChains } from "@/utils/api";

// Force dynamic rendering to avoid passing SOURCIFY_SERVER_URL env var as a build arg
export const dynamic = "force-dynamic";

export default async function Home() {
  const chains = await fetchChains();
  return (
    <div className="max-w-3xl mx-auto">
      <ServerNavigation isHomePage={true} />
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Sourcify Contract Viewer</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Enter a chain ID and contract address to view verified contract details from Sourcify.</p>
          </div>
          <HomeClient chains={chains} />
        </div>
      </div>
    </div>
  );
}
