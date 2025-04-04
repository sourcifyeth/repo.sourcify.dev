import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import AppTooltip from "@/components/AppTooltip";
import Image from "next/image";

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

export const metadata: Metadata = {
  title: "repo.sourcify.dev",
  description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
  keywords: ["Ethereum", "Smart Contracts", "Sourcify", "Blockchain", "Solidity", "Contract Verification"],
  authors: [{ name: "Sourcify" }],
  openGraph: {
    title: "repo.sourcify.dev",
    description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
    url: "https://repo.sourcify.dev",
    siteName: "repo.sourcify.dev",
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
    title: "repo.sourcify.dev",
    description: "View verified smart contract details, ABI, source code, and bytecode from Sourcify",
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
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className={`antialiased bg-gray-50 min-h-screen flex flex-col ${ibmPlexSans.className}`}>
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center">
            <Image src="/sourcify.png" alt="Sourcify Logo" className="h-8 w-auto mr-3" width={32} height={32} />
            <h1 className="text-2xl font-bold text-gray-900">Sourcify Contract Viewer</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow">{children}</main>
        <Footer />
        <AppTooltip />
      </body>
    </html>
  );
}
