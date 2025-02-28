import Link from "next/link";

interface ServerNavigationProps {
  isHomePage?: boolean;
}

export default function ServerNavigation({ isHomePage = false }: ServerNavigationProps) {
  return (
    <nav className="mb-6">
      {!isHomePage && (
        <Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      )}
    </nav>
  );
}
