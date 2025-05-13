"use client";

import { useState } from "react";
import { FaRegCopy, FaCheck } from "react-icons/fa";

interface CopyToClipboardButtonProps {
  data: unknown;
  variant?: "default" | "icon-only";
}

export default function CopyToClipboardButton({ data, variant = "default" }: CopyToClipboardButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Convert data to string and copy to clipboard
      const text = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Reset the success message after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 text-xs md:text-sm bg-white rounded-md px-2 py-2 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors duration-200 cursor-pointer relative ${
        variant === "icon-only" ? "px-2" : ""
      }`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? (
        <>
          <FaCheck className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
          {variant === "default" && <span className="text-green-600">Copied!</span>}
        </>
      ) : (
        <>
          <FaRegCopy className="h-3 w-3 md:h-4 md:w-4 text-gray-700" />
          {variant === "default" && <span className="text-gray-700">Copy</span>}
        </>
      )}
    </button>
  );
}
