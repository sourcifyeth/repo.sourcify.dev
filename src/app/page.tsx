import HomeForm from "@/components/HomeForm";
import { fetchChains } from "@/utils/fetch-chains";

// Force dynamic rendering to avoid passing SOURCIFY_SERVER_URL env var as a build arg
export const dynamic = "force-dynamic";

export default async function Home() {
  const chains = await fetchChains();
  return (
    <div className="w-full mx-auto">
      <div className="md:px-4 py-5 md:p-6 text-center">
        <h1 className="font-medium text-gray-700 font-vt323 text-3xl md:text-5xl mb-4 md:mb-8">
          Sourcify Verified Contract Repository
        </h1>
        <div className="w-full">
          <HomeForm chains={chains} />
        </div>
      </div>
    </div>
  );
}
