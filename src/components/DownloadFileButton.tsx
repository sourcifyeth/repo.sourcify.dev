"use client";

import { FiDownload } from "react-icons/fi";

interface DownloadFileButtonProps {
  data: unknown;
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
      className="inline-flex items-center gap-1 text-xs md:text-sm bg-white rounded-md px-2 py-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
    >
      <FiDownload className="h-3 w-3 md:h-4 md:w-4 text-gray-700" />
      Download
    </button>
  );
}
