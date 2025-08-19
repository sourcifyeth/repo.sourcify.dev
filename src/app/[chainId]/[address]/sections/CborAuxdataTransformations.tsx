"use client";

import React from "react";
import { BytecodeData, Transformations, TransformationValues } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";

interface CborAuxdataTransformationsProps {
  transformations?: Transformations;
  transformationValues?: TransformationValues;
  recompiledBytecode?: string;
  recompiledBytecodeCborAuxdata?: BytecodeData["cborAuxdata"];
}

export default function CborAuxdataTransformations({
  transformations,
  transformationValues,
  recompiledBytecode,
  recompiledBytecodeCborAuxdata,
}: CborAuxdataTransformationsProps) {
  if (!transformations || transformations.length === 0 || !transformationValues?.cborAuxdata || !recompiledBytecode) {
    return null;
  }

  const cborTransformations = transformations
    .filter((t) => t.reason === "cborAuxdata")
    .sort((a, b) => a.offset - b.offset);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="md:text-lg text-base font-medium leading-6 text-gray-900 md:px-6 px-3 md:py-4 py-2">
        CBOR Auxdata Transformations
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-[0.65rem] md:text-xs">
            <tr>
              <th
                scope="col"
                className="px-3 md:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
              >
                Byte Offsets
              </th>
              <th
                scope="col"
                className="px-3 md:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
              >
                Length (bytes)
              </th>
              <th
                scope="col"
                className="px-3 md:px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
              >
                Values
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 text-[0.65rem] md:text-xs">
            {cborTransformations.map((transformation) => {
              const cborAuxdata = transformationValues.cborAuxdata?.[transformation.id] || "";
              // Convert byte offset to character position (each byte is 2 hex chars)
              const originalValue = recompiledBytecodeCborAuxdata?.[transformation.id]?.value || "";

              return (
                <tr key={transformation.offset}>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap font-mono">{transformation.offset}</td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap font-mono">{originalValue.length / 2}</td>
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap font-mono">
                    <div className="flex flex-col gap-0">
                      <div className="flex items-center">
                        <span className="text-gray-500 text-xs w-36 font-sans">Original (recompiled):</span>
                        <span className="font-mono flex-1">{originalValue}</span>
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
