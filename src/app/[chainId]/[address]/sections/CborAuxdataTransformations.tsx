"use client";

import React from "react";
import { Transformations, TransformationValues } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";

interface CborAuxdataTransformationsProps {
  transformations?: Transformations;
  transformationValues?: TransformationValues;
  recompiledBytecode?: string;
}

export default function CborAuxdataTransformations({
  transformations,
  transformationValues,
  recompiledBytecode,
}: CborAuxdataTransformationsProps) {
  if (!transformations || transformations.length === 0 || !transformationValues?.cborAuxdata || !recompiledBytecode) {
    return null;
  }

  const cborTransformations = transformations
    .filter((t) => t.reason === "cborAuxdata")
    .sort((a, b) => a.offset - b.offset);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="text-lg font-medium leading-6 text-gray-900 px-6 py-4">CBOR Auxdata Transformations</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Byte Offsets
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Length (bytes)
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Values
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cborTransformations.map((transformation) => {
              const cborAuxdata = transformationValues.cborAuxdata?.[transformation.id] || "";
              // Convert byte offset to character position (each byte is 2 hex chars)
              const charOffset = transformation.offset * 2 + 2; // Add 2 for "0x" prefix
              const originalValue = recompiledBytecode.slice(charOffset, charOffset + cborAuxdata.length - 2); // Remove 2 to account for "0x" prefix

              return (
                <tr key={transformation.offset}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{transformation.offset}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{originalValue.length / 2}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    <div className="flex flex-col gap-0">
                      <div className="flex items-center">
                        <span className="text-gray-500 text-xs w-36 font-sans">Original (recompiled):</span>
                        <span className="font-mono">0x{originalValue}</span>
                        <CopyToClipboard text={`0x${originalValue}`} className="ml-2" />
                      </div>
                      <div className="flex items-center">
                        <span className="text-gray-500 text-xs w-36 font-sans">Transformed (onchain):</span>
                        <span className="font-mono">{cborAuxdata}</span>
                        <CopyToClipboard text={cborAuxdata} className="ml-2" />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
