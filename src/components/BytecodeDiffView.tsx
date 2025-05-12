"use client";

import { useEffect, useState, useRef } from "react";
import InfoTooltip from "./InfoTooltip";
import { Transformations, TransformationValues } from "@/types/contract";

interface BytecodeDiffViewProps {
  onchainBytecode: string;
  recompiledBytecode: string;
  id: string;
  transformations?: Transformations;
  transformationValues?: TransformationValues;
}

interface TransformationInfo {
  reason: string;
  originalValue: string;
  value: string;
  offset: number;
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
  const [activeTransformation, setActiveTransformation] = useState<TransformationInfo | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const tooltipCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isOnchainRecompiledSame = onchainBytecode === recompiledBytecode;

  // Clear any existing close timer when component unmounts
  useEffect(() => {
    return () => {
      if (tooltipCloseTimerRef.current) {
        clearTimeout(tooltipCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (viewMode === "onchain") {
      setCurrentView(onchainBytecode);
    } else if (viewMode === "recompiled") {
      setCurrentView(recompiledBytecode);
    }
  }, [viewMode, onchainBytecode, recompiledBytecode]);

  const handleTransformationMouseEnter = (transformationInfo: TransformationInfo) => {
    // Clear any existing close timer
    if (tooltipCloseTimerRef.current) {
      clearTimeout(tooltipCloseTimerRef.current);
      tooltipCloseTimerRef.current = null;
    }
    setActiveTransformation(transformationInfo);
  };

  const handleTransformationMouseLeave = () => {
    // Only start close timer if tooltip is not being hovered
    if (!isTooltipHovered) {
      tooltipCloseTimerRef.current = setTimeout(() => {
        setActiveTransformation(null);
      }, 500); // 500ms delay before closing
    }
  };

  const handleTooltipMouseEnter = () => {
    // Clear close timer if mouse enters the tooltip
    if (tooltipCloseTimerRef.current) {
      clearTimeout(tooltipCloseTimerRef.current);
      tooltipCloseTimerRef.current = null;
    }
    setIsTooltipHovered(true);
  };

  const handleTooltipMouseLeave = () => {
    setIsTooltipHovered(false);
    // Start timer to close tooltip
    tooltipCloseTimerRef.current = setTimeout(() => {
      setActiveTransformation(null);
    }, 300); // 300ms delay before closing
  };

  const getTransformationColor = (reason: string) => {
    switch (reason) {
      case "library":
        return "bg-blue-200 text-blue-900 border-blue-700";
      case "immutable":
        return "bg-purple-200 text-purple-900 border-purple-700";
      case "callProtection":
        return "bg-amber-200 text-amber-900 border-amber-700";
      case "constructorArguments":
        return "bg-green-200 text-green-900 border-green-700";
      case "cborAuxdata":
        return "bg-cyan-200 text-cyan-900 border-cyan-700";
      default:
        return "bg-gray-200 text-gray-900 border-gray-700";
    }
  };

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
        originalValue = recompiledBytecode.slice(charOffset, charOffset + value.length);
      }

      const colorClasses = getTransformationColor(transformation.reason);

      // Create an object with all the transformation info we need for the tooltip
      const transformationInfo = {
        reason: transformation.reason,
        originalValue,
        value,
        offset: transformation.offset,
      };

      result.push(
        <span
          key={`transformed-${index}`}
          className={`${colorClasses} cursor-help border rounded-xs hover:brightness-110 transition-all duration-200`}
          onMouseEnter={() => handleTransformationMouseEnter(transformationInfo)}
          onMouseLeave={handleTransformationMouseLeave}
        >
          {value}
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
      <li class="bg-blue-200 text-blue-900 px-2 py-1 rounded">Blue: Library addresses</li>
      <li class="bg-purple-200 text-purple-900 px-2 py-1 rounded">Purple: Immutable values</li>
      <li class="bg-amber-200 text-amber-900 px-2 py-1 rounded">Amber: Call protection</li>
      <li class="bg-green-200 text-green-900 px-2 py-1 rounded">Green: Constructor arguments</li>
      <li class="bg-cyan-200 text-cyan-900 px-2 py-1 rounded">Cyan: CBOR Auxdata</li>
    </ul>
    <p class="mt-2">Hover over the colored sections to see transformation details.</p>
  `;

  return (
    <div className="relative">
      {/* Fixed tooltip area as an overlay */}
      {viewMode === "transformations" && (
        <div
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 z-10 p-3 rounded shadow-md text-xs min-w-[200px] max-w-[80%] transition-all duration-300 ease-in-out ${
            activeTransformation
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
          } ${
            activeTransformation ? getTransformationColor(activeTransformation.reason) : "bg-gray-100 text-gray-800"
          }`}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {activeTransformation && (
            <div className="text-xs flex flex-col gap-1 font-sans">
              <div className="flex gap-1">
                <span className="font-semibold">Reason:</span>
                <span className="font-mono ml-1">{activeTransformation.reason}</span>
              </div>
              {activeTransformation.originalValue && (
                <div className="flex gap-1">
                  <span className="font-semibold">Original:</span>
                  <span className="font-mono ml-1 break-all">0x{activeTransformation.originalValue}</span>
                </div>
              )}
              <div className="flex gap-1">
                <span className="font-semibold">Transformed:</span>
                <span className="font-mono ml-1 break-all">0x{activeTransformation.value}</span>
              </div>
              <div className="flex gap-1">
                <span className="font-semibold">Offset:</span>
                <span className="font-mono ml-1 break-all">{activeTransformation.offset} bytes</span>
              </div>
            </div>
          )}
        </div>
      )}

      {onchainBytecode ===
        "0x2121212121212121212121202d20636861696e207761732064657072656361746564206174207468652074696d65206f6620766572696669636174696f6e" && (
        <div className="w-full text-sm my-2">
          <div>
            <span>
              Chain was deprecated at the time of verification but sources were verified on an early Sourcify version.
              The onchain bytecode below is a placeholder in database
            </span>
          </div>
        </div>
      )}
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
