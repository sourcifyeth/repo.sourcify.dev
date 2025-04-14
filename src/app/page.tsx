import HomeForm from "@/components/HomeForm";
import { fetchChains } from "@/utils/api";

// Force dynamic rendering to avoid passing SOURCIFY_SERVER_URL env var as a build arg
export const dynamic = "force-dynamic";

export default async function Home() {
  const chains = await fetchChains();
  return (
    <div className="w-full mx-auto">
      <div className="px-4 py-5 sm:p-6 text-center flex flex-col items-center">
        <h1 className="font-medium text-gray-700  font-vt323 text-5xl">Sourcify Verified Contract Repository</h1>
        <HomeForm chains={chains} />
      </div>
    </div>
  );
}
