"use client";

import { FiDownload } from "react-icons/fi";

interface DownloadFileButtonProps {
  data: Record<string, unknown>;
  fileName: string;
  chainId: string;
  address: string;
}

export default function DownloadFileButton({ data, fileName, chainId, address }: DownloadFileButtonProps) {
  const handleDownload = () => {
    // Create a blob with the JSON data
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chain-${chainId}-${address.slice(0, 10)}-${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <button
      onClick={handleDownload}
      className="mt-2 inline-flex items-center gap-2 text-xs bg-white rounded-md p-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
    >
      <FiDownload className="w-5 h-5 text-gray-700" />
      Download
    </button>
  );
}
