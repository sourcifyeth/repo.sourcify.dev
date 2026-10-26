import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, VT323 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Footer from "@/components/Footer";
import AppTooltip from "@/components/AppTooltip";
import StagingBanner from "@/components/StagingBanner";
import Header from "@/components/Header";

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
  // Makes relative image URLs absolute. Contract pages set their own, from the request's host.
  metadataBase: new URL("https://repo.sourcify.dev"),
  title: "repo.sourcify.dev",
  description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
  keywords: ["Ethereum", "Smart Contracts", "Sourcify", "Blockchain", "Solidity", "Contract Verification"],
  authors: [{ name: "Sourcify" }],
  // The images come from opengraph-image.tsx files (the root one, or a page's own)
  openGraph: {
    title: "repo.sourcify.dev",
    description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
    url: "/",
    siteName: "repo.sourcify.dev",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "repo.sourcify.dev",
    description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
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
        <StagingBanner />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
        <Header />
        <main className="w-full max-w-[100rem] mx-auto px-6 md:px-12 lg:px-12 xl:px-24 py-6 flex-grow">{children}</main>
        <Footer />
        <AppTooltip />
      </body>
    </html>
  );
}
