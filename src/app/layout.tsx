import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, VT323 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppTooltip from "@/components/AppTooltip";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

const vt323 = VT323({
  weight: ["400"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-vt-323",
});

export const metadata: Metadata = {
  title: "repo.walnut.dev",
  description:
    "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
  keywords: [
    "Ethereum",
    "Smart Contracts",
    "Sourcify",
    "Blockchain",
    "Solidity",
    "Contract Verification",
  ],
  authors: [{ name: "Sourcify" }],
  openGraph: {
    title: "walnut.sourcify.dev",
    description:
      "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
    url: "https://repo.walnut.dev",
    siteName: "walnut.sourcify.dev",
    images: [
      {
        url: "https://sourcify.dev/sourcify-logo.svg",
        width: 1200,
        height: 630,
        alt: "Sourcify Contract Viewer",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "repo.walnut.dev",
    description:
      "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
    images: ["https://sourcify.dev/sourcify-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={``}>
      <body
        className={`bg-gray-100 min-h-screen flex flex-col font-sans ${ibmPlexSans.variable} ${ibmPlexMono.variable} ${vt323.variable}`}
      >
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        <Header />
        <main className="w-full max-w-[100rem] mx-auto px-6 md:px-12 lg:px-12 xl:px-24 py-6 flex-grow">
          {children}
        </main>
        <Footer />
        <AppTooltip />
      </body>
    </html>
  );
}
