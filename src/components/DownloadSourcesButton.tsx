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
      className="my-2 inline-flex items-center gap-2 text-xs bg-white rounded-md p-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200 ml-2 cursor-pointer"
    >
      <FiDownload className="w-5 h-5 text-gray-700" />
      Download Sources
    </button>
  );
}
