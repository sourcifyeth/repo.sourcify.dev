"use client";

import { useState } from "react";
import InfoTooltip from "./InfoTooltip";
import CopyToClipboard from "./CopyToClipboard";

interface CodeData {
  name: string;
  value: string;
  notBytes?: boolean;
}

interface ToggledRawCodeViewProps {
  data1: CodeData;
  data2: CodeData;
  tooltipContent?: string;
  className?: string;
}

export default function ToggledRawCodeView({ data1, data2, tooltipContent, className }: ToggledRawCodeViewProps) {
  const [showFirstOption, setShowFirstOption] = useState(true);

  const currentData = showFirstOption ? data1 : data2;

  // Calculate data length
  const bytesLength = currentData.value?.length
    ? Math.floor(currentData.value.length / 2) - (currentData.value.startsWith("0x") ? 1 : 0) // Subtract 1 for 0x if present
    : 0;

  return (
    <div className={`${className}`}>
      <div className="mb-2 flex items-center">
        <span className={`mr-2 text-sm ${showFirstOption ? "font-medium" : "text-gray-500"}`}>{data1.name}</span>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!showFirstOption}
            onChange={() => setShowFirstOption(!showFirstOption)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-900 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-200"></div>
        </label>

        <span className={`ml-2 text-sm ${!showFirstOption ? "font-medium" : "text-gray-500"}`}>{data2.name}</span>

        {tooltipContent && <InfoTooltip content={tooltipContent} className="ml-2" />}
      </div>

      {!currentData.notBytes && (
        <div className="mb-1 mr-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">Length: {bytesLength} bytes</span>
          <CopyToClipboard text={currentData.value} className="ml-2" />
        </div>
      )}

      <div className="w-full max-h-64 p-3 bg-gray-50 rounded text-xs font-mono border border-gray-200 cursor-text break-words overflow-y-auto whitespace-pre-wrap">
        {currentData.value}
      </div>
    </div>
  );
}
