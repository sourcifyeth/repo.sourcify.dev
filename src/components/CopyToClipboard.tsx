"use client";

import { useState } from "react";
import { FaCopy, FaCheck } from "react-icons/fa";
import { copyText } from "@/utils/clipboard";

interface CopyToClipboardProps {
  text: string;
  className?: string;
  iconClassName?: string;
  successDuration?: number;
}

export default function CopyToClipboard({
  text,
  className = "",
  iconClassName = "text-gray-400 hover:text-gray-600 cursor-pointer",
  successDuration = 1000,
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyText(text))) {
      console.error("Failed to copy text");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), successDuration);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center transition-colors ${className}`}
      aria-label="Copy to clipboard"
      data-tooltip-id="global-tooltip"
      data-tooltip-content={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <FaCheck className={iconClassName} /> : <FaCopy className={iconClassName} />}
    </button>
  );
}
