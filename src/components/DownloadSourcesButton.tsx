"use client";

import { FiDownload } from "react-icons/fi";

interface DownloadSourcesButtonProps {
  sources: Record<string, { content: string }>;
  chainId: string;
  address: string;
}

export default function DownloadSourcesButton({ sources, chainId, address }: DownloadSourcesButtonProps) {
  const handleDownload = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Add each source file to the zip
    Object.entries(sources).forEach(([filename, { content }]) => {
      zip.file(filename, content);
    });

    // Generate and download the zip file
    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chain-${chainId}-${address.slice(0, 10)}-sources.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1 text-xs bg-white rounded-md px-2 py-1 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
    >
      <FiDownload className="w-4 h-4 text-gray-700" />
      Download Sources
    </button>
  );
}
