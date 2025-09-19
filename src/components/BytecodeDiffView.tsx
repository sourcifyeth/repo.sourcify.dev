"use client";

import { useEffect, useState, useRef } from "react";
import InfoTooltip from "./InfoTooltip";
import { BytecodeData, Transformations, TransformationValues, SignatureData } from "@/types/contract";
import { useIsMobile } from "@/hooks/useResponsive";

interface BytecodeDiffViewProps {
  onchainBytecode: string;
  recompiledBytecode: string;
  id: string;
  transformations?: Transformations;
  transformationValues?: TransformationValues;
  recompiledBytecodeCborAuxdata?: BytecodeData["cborAuxdata"];
  signatures?: SignatureData;
}

interface AnnotationInfo {
  reason: string;
  originalValue: string;
  value: string;
  offset: number;
}

interface SignatureTransformation {
  reason: string;
  type: "replace";
  offset: number;
  id: string;
  signature: string;
  signatureHash32: string;
  signatureHash4: string;
}

export default function BytecodeDiffView({
  onchainBytecode,
  recompiledBytecode,
  id,
  transformations,
  transformationValues,
  recompiledBytecodeCborAuxdata,
  signatures,
}: BytecodeDiffViewProps) {
  const [viewMode, setViewMode] = useState<"annotations" | "onchain" | "recompiled">("annotations");
  const [currentView, setCurrentView] = useState<string>(recompiledBytecode);
  const [activeAnnotation, setActiveAnnotation] = useState<AnnotationInfo | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const tooltipCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use the isMobile hook to check screen size
  const isMobile = useIsMobile();

  const isOnchainRecompiledSame = onchainBytecode === recompiledBytecode;

  // Check if there are library references in the transformations
  const hasLibraryTransformations = transformations?.some((t) => t.reason === "library");

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

  const handleAnnotationMouseEnter = (annotationInfo: AnnotationInfo) => {
    // Clear any existing close timer
    if (tooltipCloseTimerRef.current) {
      clearTimeout(tooltipCloseTimerRef.current);
      tooltipCloseTimerRef.current = null;
    }
    setActiveAnnotation(annotationInfo);
  };

  const renderAnnotationTooltipContent = (annotation: AnnotationInfo) => {
    if (annotation.reason.endsWith("Signature")) {
      const hashLabel = annotation.reason === "eventSignature" ? "32byte Hash" : "4byte Hash";
      const tooltipValues = {
        Reason: annotation.reason,
        Signature: annotation.originalValue,
        [hashLabel]: "0x" + annotation.value,
        Offset: annotation.offset + " bytes",
      };
      return (
        <div className="text-xs flex flex-col gap-2 font-sans w-full">
          {Object.entries(tooltipValues).map(([key, value]) => (
            <div className="flex flex-wrap items-baseline" key={key}>
              <span className="font-semibold whitespace-nowrap mr-1">{key}:</span>
              <span className="font-mono overflow-hidden">{value}</span>
            </div>
          ))}
        </div>
      );
    } else {
      const tooltipValues: Record<string, string> = {
        Reason: annotation.reason,
        ...(annotation.originalValue && {
          Original:
            (annotation.originalValue.startsWith("__") || annotation.originalValue.startsWith("0x") ? "" : "0x") +
            annotation.originalValue,
        }),
        Transformed: "0x" + annotation.value,
        Offset: annotation.offset + " bytes",
      };

      return (
        <div className="text-xs flex flex-col gap-2 font-sans w-full">
          {Object.entries(tooltipValues).map(([key, value]) => (
            <div className="flex flex-wrap items-baseline" key={key}>
              <span className="font-semibold whitespace-nowrap mr-1">{key}:</span>
              <span className="font-mono overflow-hidden break-words">{value}</span>
            </div>
          ))}
        </div>
      );
    }
  };

  const handleAnnotationMouseLeave = () => {
    // Only start close timer if tooltip is not being hovered
    if (!isTooltipHovered) {
      tooltipCloseTimerRef.current = setTimeout(() => {
        setActiveAnnotation(null);
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
      setActiveAnnotation(null);
    }, 300); // 300ms delay before closing
  };

  const getAnnotationColor = (reason: string) => {
    switch (reason) {
      case "library":
        return "bg-blue-200 text-blue-900";
      case "immutable":
        return "bg-purple-200 text-purple-900";
      case "callProtection":
        return "bg-amber-200 text-amber-900";
      case "constructorArguments":
        return "bg-green-200 text-green-900";
      case "cborAuxdata":
        return "bg-cyan-200 text-cyan-900";
      case "functionSignature":
        return "bg-orange-100 text-gray-600";
      case "errorSignature":
        return "bg-rose-100 text-gray-700";
      case "eventSignature":
        return "bg-teal-100 text-gray-700";
      default:
        return "bg-gray-200 text-gray-900";
    }
  };

  // Function to detect signatures in recompiled bytecode and return transformation-like objects
  const detectSignatures = () => {
    if (!signatures) return [];

    const signatureTransformations: Array<SignatureTransformation> = [];

    const bytecodeWithoutPrefix = recompiledBytecode.startsWith("0x")
      ? recompiledBytecode.slice(2)
      : recompiledBytecode;
    const foundOffsets = new Set<number>(); // Track found offsets to avoid overlaps

    // Search for function and error signatures (4-byte hashes)
    [...signatures.function, ...signatures.error].forEach((sig) => {
      const hash4WithoutPrefix = sig.signatureHash4.startsWith("0x") ? sig.signatureHash4.slice(2) : sig.signatureHash4;
      let searchIndex = 0;

      while (true) {
        const index = bytecodeWithoutPrefix.indexOf(hash4WithoutPrefix, searchIndex);
        if (index === -1) break;

        const byteOffset = index / 2;

        // Skip if we already have an annotation at this offset (avoid overlaps)
        if (!foundOffsets.has(byteOffset)) {
          foundOffsets.add(byteOffset);

          const sigType = signatures.function.includes(sig) ? "function" : "error";
          signatureTransformations.push({
            reason: `${sigType}Signature`,
            type: "replace",
            offset: byteOffset,
            id: sig.signature,
            signature: sig.signature,
            signatureHash4: sig.signatureHash4,
            signatureHash32: sig.signatureHash32,
          });
        }

        searchIndex = index + hash4WithoutPrefix.length;
      }
    });

    // Search for event signatures (32-byte hashes)
    signatures.event.forEach((sig) => {
      const hash32WithoutPrefix = sig.signatureHash32.startsWith("0x")
        ? sig.signatureHash32.slice(2)
        : sig.signatureHash32;
      let searchIndex = 0;

      while (true) {
        const index = bytecodeWithoutPrefix.indexOf(hash32WithoutPrefix, searchIndex);
        if (index === -1) break;

        const byteOffset = index / 2;

        // Skip if we already have an annotation at this offset (avoid overlaps)
        if (!foundOffsets.has(byteOffset)) {
          foundOffsets.add(byteOffset);

          signatureTransformations.push({
            reason: "eventSignature",
            type: "replace",
            offset: byteOffset,
            id: sig.signature,
            signature: sig.signature,
            signatureHash32: sig.signatureHash32,
            signatureHash4: sig.signatureHash4,
          });
        }

        searchIndex = index + hash32WithoutPrefix.length;
      }
    });

    return signatureTransformations;
  };

  const renderAnnotations = () => {
    // Get signature annotations
    const signatureAnnotations = detectSignatures();

    // Combine transformations and signatures, or just use signatures if no transformations
    const allAnnotations =
      transformations && transformationValues
        ? [...transformations, ...signatureAnnotations].sort((a, b) => a.offset - b.offset)
        : signatureAnnotations.sort((a, b) => a.offset - b.offset);

    if (allAnnotations.length === 0) return onchainBytecode;

    // Sort annotations by offset to process them in order
    const sortedAnnotations = allAnnotations;

    const result = [];
    let currentIndex = 2; // Start after "0x"

    // Add the "0x" prefix
    result.push(
      <span key={`prefix-${id}`} className="text-gray-800">
        {recompiledBytecode.slice(0, 2)}
      </span>
    );

    sortedAnnotations.forEach((annotation, index) => {
      // Convert byte offset to character position (each byte is 2 hex chars)
      const charOffset = annotation.offset * 2 + 2; // Add 2 for "0x" prefix

      // Add the unchanged part before the transformation
      if (currentIndex < charOffset) {
        result.push(
          <span key={`unchanged-${id}-${index}`} className="text-gray-800 break-all">
            {recompiledBytecode.slice(currentIndex, charOffset)}
          </span>
        );
      }

      currentIndex = charOffset;

      // Add the transformed part
      let value = "";

      // Handle signature annotations
      if (annotation.reason.endsWith("Signature")) {
        const hash =
          (annotation as SignatureTransformation).reason === "eventSignature"
            ? (annotation as SignatureTransformation).signatureHash32
            : (annotation as SignatureTransformation).signatureHash4;
        value = hash.startsWith("0x") ? hash.slice(2) : hash;
      }
      // Handle regular transformations
      else if (transformationValues) {
        if (annotation.reason === "library" && transformationValues.libraries) {
          value = transformationValues.libraries[annotation.id];
        } else if (annotation.reason === "immutable" && transformationValues.immutables) {
          value = transformationValues.immutables[annotation.id];
        } else if (annotation.reason === "callProtection" && transformationValues.callProtection) {
          value = transformationValues.callProtection;
        } else if (annotation.reason === "constructorArguments" && transformationValues.constructorArguments) {
          value = transformationValues.constructorArguments;
        } else if (annotation.reason === "cborAuxdata" && transformationValues.cborAuxdata) {
          value = transformationValues.cborAuxdata[annotation.id];
        }
      }

      // Remove 0x prefix if present
      if (value && value.startsWith("0x")) {
        value = value.slice(2);
      }

      // Get the original value from the recompiled bytecode
      let originalValue = "";
      if (annotation.reason === "constructorArguments") {
        originalValue = "";
      } else if (annotation.reason.endsWith("Signature")) {
        // For signatures, show the signature text as the original value
        originalValue = (annotation as SignatureTransformation).signature;
      } else if (annotation.reason === "cborAuxdata") {
        originalValue = recompiledBytecodeCborAuxdata?.[annotation.id]?.value || "";
      } else {
        const charOffset = annotation.offset * 2 + 2; // Add 2 for "0x" prefix
        originalValue = recompiledBytecode.slice(charOffset, charOffset + value.length);
      }

      const colorClasses = getAnnotationColor(annotation.reason);

      // Create an object with all the annotation info we need for the tooltip
      const annotationInfo = {
        reason: annotation.reason,
        originalValue,
        value,
        offset: annotation.offset,
      };

      result.push(
        <span
          key={`annotation-${index}`}
          className={`break-all ${colorClasses} cursor-help rounded-xs hover:brightness-110 transition-all duration-200 relative overflow-x-clip ring-1 ring-inset ring-current`}
          onMouseEnter={() => handleAnnotationMouseEnter(annotationInfo)}
          onMouseLeave={handleAnnotationMouseLeave}
        >
          <span
            className={`absolute -top-2 text-[7.5px] font-bold ${colorClasses.split(" ")[1]} ${
              colorClasses.split(" ")[0]
            } opacity-100 select-none pointer-events-none px-[3px] py-[1px] rounded whitespace-nowrap`}
          >
            {annotation.reason}
          </span>
          {value}
        </span>
      );
      // Update currentIndex based on the length of the value in characters
      currentIndex = charOffset + value.length;
    });

    // Add any remaining unchanged part (except for constructor arguments which are handled above)
    if (currentIndex < onchainBytecode.length) {
      result.push(
        <span key="remaining" className="text-gray-800 break-all">
          {onchainBytecode.slice(currentIndex)}
        </span>
      );
    }

    return result;
  };

  const annotationsTooltipContent = `
    <p>This view shows annotations on the bytecode including function/error signatures and transformations applied to match the on-chain bytecode.</p>
    <ul class="mt-2">
      <p>Transformations:</p>
        <li class="text-gray-800 bg-gray-100 px-2 py-1 rounded">Black: Unchanged bytecode</li>
      <li class="bg-blue-200 text-blue-900 px-2 py-1 rounded">Blue: Library addresses</li>
      <li class="bg-purple-200 text-purple-900 px-2 py-1 rounded">Purple: Immutable values</li>
      <li class="bg-amber-200 text-amber-900 px-2 py-1 rounded">Amber: Call protection</li>
      <li class="bg-green-200 text-green-900 px-2 py-1 rounded">Green: Constructor arguments</li>
      <li class="bg-cyan-200 text-cyan-900 px-2 py-1 rounded">Cyan: CBOR Auxdata</li>
      <p>Signatures:</p>
      <li class="bg-orange-100 text-gray-600 px-2 py-1 rounded">Orange: Function signatures</li>
      <li class="bg-rose-100 text-rose-900 px-2 py-1 rounded">Red: Error signatures</li>
      <li class="bg-teal-100 text-gray-700 px-2 py-1 rounded">Teal: Event signatures</li>
    </ul>
    <p class="mt-2">Hover over the colored sections to see details.</p>
  `;

  return (
    <div className="relative">
      {/* Fixed tooltip area as an overlay */}
      {viewMode === "annotations" && (
        <div
          className={`absolute top-0 left-1/2 transform -translate-x-1/2 z-10 p-3 rounded shadow-md text-xs max-w-[80%] transition-all duration-300 ease-in-out ${
            activeAnnotation
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
          } ${activeAnnotation ? getAnnotationColor(activeAnnotation.reason) : "bg-gray-100 text-gray-800"}`}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {activeAnnotation && renderAnnotationTooltipContent(activeAnnotation)}
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
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:my-2 my-2">
        <div className="flex items-center gap-1">
          <input
            type="radio"
            id={`annotations-${id}`}
            name={`bytecode-view-${id}`}
            value="annotations"
            checked={viewMode === "annotations"}
            onChange={() => setViewMode("annotations")}
            className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300"
          />
          <label htmlFor={`annotations-${id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
            Annotated Bytecode
          </label>
          <InfoTooltip content={annotationsTooltipContent} html={true} />
        </div>
        <div className="flex items-center gap-1">
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
            {isOnchainRecompiledSame ? (
              <span className="flex items-center gap-1">
                On-chain & Recompiled Bytecode
                <InfoTooltip
                  content="The on-chain and recompiled bytecodes are exactly the same, with no transformations needed."
                  html={false}
                />
              </span>
            ) : (
              "On-chain Bytecode"
            )}
          </label>
        </div>
        {!isOnchainRecompiledSame && (
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
        )}
      </div>

      <div
        className={`w-full max-h-64 p-3 bg-gray-50 rounded font-mono border border-gray-200 cursor-text break-words overflow-y-auto whitespace-pre-wrap overflow-x-clip ${
          isMobile ? "text-[0.65rem]" : "text-xs"
        }`}
      >
        {viewMode === "annotations" ? renderAnnotations() : currentView}
      </div>

      {/* Add library placeholder info message */}
      {viewMode === "recompiled" && hasLibraryTransformations && (
        <div
          className={`mt-2 italic border-l-2 border-gray-300 pl-2 text-gray-600 ${isMobile ? "text-[9px]" : "text-xs"}`}
        >
          Library placeholders are inserted on the frontend, the value in the DB and the API contains `0000`s for
          placeholders in the bytecode
        </div>
      )}
    </div>
  );
}
