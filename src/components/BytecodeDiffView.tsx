"use client";

import { useEffect, useState } from "react";
import InfoTooltip from "./InfoTooltip";
import { Tooltip } from "react-tooltip";
import { Transformations, TransformationValues } from "@/types/contract";

interface BytecodeDiffViewProps {
  onchainBytecode: string;
  recompiledBytecode: string;
  id: string;
  transformations?: Transformations;
  transformationValues?: TransformationValues;
}

export default function BytecodeDiffView({
  onchainBytecode,
  recompiledBytecode,
  id,
  transformations,
  transformationValues,
}: BytecodeDiffViewProps) {
  const [viewMode, setViewMode] = useState<"transformations" | "onchain" | "recompiled">(
    transformations && transformations.length > 0 ? "transformations" : "onchain" // If no transformations, show onchain bytecode
  );
  const [currentView, setCurrentView] = useState<string>(recompiledBytecode);

  const isOnchainRecompiledSame = onchainBytecode === recompiledBytecode;

  useEffect(() => {
    if (viewMode === "onchain") {
      setCurrentView(onchainBytecode);
    } else if (viewMode === "recompiled") {
      setCurrentView(recompiledBytecode);
    }
  }, [viewMode, onchainBytecode, recompiledBytecode]);

  const renderTransformations = () => {
    if (!transformations || !transformationValues) return onchainBytecode;

    // Sort transformations by offset to process them in order
    const sortedTransformations = [...transformations].sort((a, b) => a.offset - b.offset);

    const result = [];
    let currentIndex = 2; // Start after "0x"

    // Add the "0x" prefix
    result.push(
      <span key={`prefix-${id}`} className="text-gray-800">
        {recompiledBytecode.slice(0, 2)}
      </span>
    );

    sortedTransformations.forEach((transformation, index) => {
      // Convert byte offset to character position (each byte is 2 hex chars)
      const charOffset = transformation.offset * 2 + 2; // Add 2 for "0x" prefix

      // Add the unchanged part before the transformation
      if (currentIndex < charOffset) {
        result.push(
          <span key={`unchanged-${id}-${index}`} className="text-gray-800">
            {recompiledBytecode.slice(currentIndex, charOffset)}
          </span>
        );
      }

      currentIndex = charOffset;

      // Add the transformed part
      let value = "";
      if (transformation.reason === "library" && transformationValues.libraries) {
        value = transformationValues.libraries[transformation.id];
      } else if (transformation.reason === "immutable" && transformationValues.immutables) {
        value = transformationValues.immutables[transformation.id];
      } else if (transformation.reason === "callProtection" && transformationValues.callProtection) {
        value = transformationValues.callProtection;
      } else if (transformation.reason === "constructorArguments" && transformationValues.constructorArguments) {
        value = transformationValues.constructorArguments;
      } else if (transformation.reason === "cborAuxdata" && transformationValues.cborAuxdata) {
        value = transformationValues.cborAuxdata[transformation.id];
      }

      // Remove 0x prefix if present
      if (value && value.startsWith("0x")) {
        value = value.slice(2);
      }

      // Get the original value from the recompiled bytecode
      let originalValue = "";
      if (transformation.reason !== "constructorArguments") {
        const charOffset = transformation.offset * 2 + 2; // Add 2 for "0x" prefix
        originalValue = recompiledBytecode.slice(charOffset, charOffset + value.length * 2);
      }

      const tooltipId = `transformation-${id}-${index}`;
      result.push(
        <span
          key={`transformed-${index}`}
          className="bg-cyan-200 text-cyan-900 cursor-help border border-cyan-700 rounded-xs hover:bg-cyan-400"
          data-tooltip-id={tooltipId}
        >
          {value}
          <Tooltip
            id={tooltipId}
            className="!p-3 !max-w-md lg:!max-w-4xl !z-50"
            place="top"
            delayShow={0}
            delayHide={0}
            render={() => (
              <div className="text-xs flex flex-col gap-1 font-sans">
                <div className="flex  gap-1">
                  <span className="text-gray-500">Reason:</span>
                  <span className="font-mono ml-1">{transformation.reason}</span>
                </div>
                {originalValue && (
                  <div className="flex  gap-1">
                    <span className="text-gray-500">Original:</span>
                    <span className="font-mono ml-1 break-all">0x{originalValue}</span>
                  </div>
                )}
                <div className="flex  gap-1">
                  <span className="text-gray-500">Transformed:</span>
                  <span className="font-mono ml-1 break-all">0x{value}</span>
                </div>
                <div className="flex  gap-1">
                  <span className="text-gray-500">Offset:</span>
                  <span className="font-mono ml-1 break-all">{transformation.offset} bytes</span>
                </div>
              </div>
            )}
          />
        </span>
      );
      // Update currentIndex based on the length of the value in characters
      currentIndex = charOffset + value.length;
    });

    // Add any remaining unchanged part (except for constructor arguments which are handled above)
    if (currentIndex < onchainBytecode.length) {
      result.push(
        <span key="remaining" className="text-gray-800">
          {onchainBytecode.slice(currentIndex)}
        </span>
      );
    }

    return result;
  };

  const transformationsTooltipContent = `
    <p>This view shows the transformations applied to the recompiled bytecode to match the on-chain bytecode.</p>
    <ul class="mt-2">
      <li class="text-gray-800 bg-gray-100 px-2 py-1 rounded">Black: Unchanged bytecode</li>
      <li class="bg-cyan-200 text-cyan-900 px-2 py-1 rounded">Cyan: Transformed sections</li>
    </ul>
    <p class="mt-2">Hover over the colored sections to see transformation details.</p>
  `;

  return (
    <div>
      {!isOnchainRecompiledSame && (
        <div className="flex items-center gap-4 my-2">
          {transformations && transformations.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id={`transformations-${id}`}
                name={`bytecode-view-${id}`}
                value="transformations"
                checked={viewMode === "transformations"}
                onChange={() => setViewMode("transformations")}
                className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300"
              />
              <label htmlFor={`transformations-${id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                Transformations View
              </label>
              <InfoTooltip content={transformationsTooltipContent} html={true} />
            </div>
          )}
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
      )}
      {isOnchainRecompiledSame && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">On-chain & Recompiled Bytecode</span>
          <InfoTooltip
            content="The on-chain and recompiled bytecodes are exactly the same, with no transformations needed."
            html={false}
          />
        </div>
      )}

      <div className="w-full max-h-64 p-3 bg-gray-50 rounded text-xs font-mono border border-gray-200 cursor-text break-words overflow-y-auto whitespace-pre-wrap">
        {viewMode === "transformations" ? renderTransformations() : currentView}
      </div>
    </div>
  );
}
