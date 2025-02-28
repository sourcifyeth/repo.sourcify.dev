"use client";

import { useState } from "react";
import { IoIosCopy, IoMdCheckmark } from "react-icons/io";

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
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), successDuration);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center transition-colors ${className}`}
      aria-label="Copy to clipboard"
      data-tooltip-id="global-tooltip"
      data-tooltip-content={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <IoMdCheckmark className={`${iconClassName}`} /> : <IoIosCopy className={iconClassName} />}
    </button>
  );
}
