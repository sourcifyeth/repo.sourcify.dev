"use client";

import { useState } from "react";
import InfoTooltip from "./InfoTooltip";
import CopyToClipboard from "./CopyToClipboard";
import { BytecodeData } from "@/types/contract";

interface BytecodeProps {
  title: string;
  bytecodeData: BytecodeData;
}

export default function Bytecode({ title, bytecodeData }: BytecodeProps) {
  const [showOnchain, setShowOnchain] = useState(true);

  const bytecode = showOnchain ? bytecodeData.onchainBytecode : bytecodeData.recompiledBytecode;

  // Calculate bytecode length
  const bytesLength = bytecode?.length
    ? Math.floor(bytecode.length / 2) - 1 // Subtract 1 for 0x
    : 0;

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>

      <div className="mb-2 flex items-center">
        <span className={`mr-2 text-sm ${showOnchain ? "font-medium" : "text-gray-500"}`}>on-chain bytecode</span>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!showOnchain}
            onChange={() => setShowOnchain(!showOnchain)}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-900 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-200"></div>
        </label>

        <span className={`ml-2 text-sm ${!showOnchain ? "font-medium" : "text-gray-500"}`}>recompiled bytecode</span>

        <InfoTooltip
          content="On-chain bytecode is retrieved from the blockchain. Recompiled bytecode is generated from the source code."
          className="ml-2"
        />
      </div>

      <div className="mb-1 mr-2 flex items-center justify-between">
        <span className="text-sm text-gray-500">Length: {bytesLength} bytes</span>
        <CopyToClipboard text={bytecode} className="ml-2" />
      </div>

      <textarea
        className="w-full h-64 p-3 bg-gray-50 rounded text-xs font-mono border border-gray-200"
        value={bytecode}
        readOnly
      />
    </section>
  );
}
