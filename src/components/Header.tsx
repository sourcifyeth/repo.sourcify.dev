import Image from "next/image";
import Link from "next/link";
import { fetchSession } from "@/utils/fetch-session";

export default async function Header() {
  const session = await fetchSession();
  return (
    <header className="shadow-sm">
      <div className="mx-auto py-3 md:py-4 flex items-center justify-between w-full max-w-[100rem] px-4 md:px-12 lg:px-12 xl:px-24">
        <Link href="/" className="flex items-center">
          <Image
            src="/walnut.png"
            alt="Walnut Logo"
            className="h-8 md:h-10 w-auto mr-2 md:mr-3 rounded-full"
            width={400}
            height={400}
          />
          <span className="text-gray-700 font-vt323 text-xl md:text-2xl">
            repo.walnut.
            {process.env.NODE_ENV === "production" ? "dev" : "local"}
          </span>
        </Link>
        <a
          href={
            process.env.NODE_ENV === "production"
              ? "https://evm.walnut.dev"
              : "http://evm.walnut.local"
          }
          aria-label="Back to Walnut"
        >
          <Image
            src={session?.user.image ?? "/walnut.png"}
            alt={
              session ? `User avatar for ${session.user.name}` : "Walnut Logo"
            }
            className="size-8 rounded-full"
            width={32}
            height={32}
          />
        </a>
      </div>
    </header>
  );
}
