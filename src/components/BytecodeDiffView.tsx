"use client";

import { useMemo, useEffect, useState } from "react";
import { diffChars, Change } from "diff";
import InfoTooltip from "./InfoTooltip";

interface BytecodeDiffViewProps {
  onchainBytecode: string;
  recompiledBytecode: string;
  id: string;
}

export default function BytecodeDiffView({ onchainBytecode, recompiledBytecode, id }: BytecodeDiffViewProps) {
  const [viewMode, setViewMode] = useState<"diff" | "onchain" | "recompiled">("diff");
  const diff = useMemo(() => diffChars(onchainBytecode, recompiledBytecode), [onchainBytecode, recompiledBytecode]);
  const [currentDiff, setCurrentDiff] = useState<Change[]>(diff);

  useEffect(() => {
    if (viewMode === "onchain") {
      // Create a dummy diff where everything is unchanged to aviod rerendering the code display
      setCurrentDiff([{ value: onchainBytecode, added: false, removed: false }]);
    } else if (viewMode === "recompiled") {
      // Create a dummy diff where everything is unchanged to aviod rerendering the code display
      setCurrentDiff([{ value: recompiledBytecode, added: false, removed: false }]);
    } else {
      // Create actual diff
      setCurrentDiff(diff);
    }
  }, [viewMode, diff, onchainBytecode, recompiledBytecode]);

  const diffTooltipContent = `
    <p>This view shows the differences between the on-chain bytecode and the recompiled bytecode.</p>
    <ul class="mt-2">
      <li class="text-gray-800 bg-gray-100 px-2 py-1 rounded">Black: Found in both bytecodes</li>
      <li class="bg-cyan-200 text-cyan-900 px-2 py-1 rounded">Cyan: Found in recompiled bytecode</li>
      <li class="bg-purple-200 text-purple-900 px-2 py-1 rounded">Purple: Found in on-chain bytecode</li>
    </ul>
  `;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            id={`diff-${id}`}
            name={`bytecode-view-${id}`}
            value="diff"
            checked={viewMode === "diff"}
            onChange={() => setViewMode("diff")}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300"
          />
          <label htmlFor={`diff-${id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
            Diff View
          </label>
          <InfoTooltip content={diffTooltipContent} html={true} />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="radio"
            id={`onchain-${id}`}
            name={`bytecode-view-${id}`}
            value="onchain"
            checked={viewMode === "onchain"}
            onChange={() => setViewMode("onchain")}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300"
          />
          <label htmlFor={`onchain-${id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
            On-chain Bytecode
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="radio"
            id={`recompiled-${id}`}
            name={`bytecode-view-${id}`}
            value="recompiled"
            checked={viewMode === "recompiled"}
            onChange={() => setViewMode("recompiled")}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300"
          />
          <label htmlFor={`recompiled-${id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
            Recompiled Bytecode
          </label>
        </div>
      </div>

      <div className="w-full max-h-64 p-3 bg-gray-50 rounded text-xs font-mono border border-gray-200 cursor-text break-words overflow-y-auto whitespace-pre-wrap">
        {currentDiff.map((part: Change, index: number) => {
          const className = part.added
            ? "bg-cyan-200 text-cyan-900"
            : part.removed
            ? "bg-purple-200 text-purple-900"
            : "text-gray-800";
          return (
            <span key={index} className={className}>
              {part.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}
