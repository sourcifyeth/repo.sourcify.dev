"use client";

import React from "react";
import { Transformations, TransformationValues } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";

interface LibraryTransformationsProps {
  transformations?: Transformations;
  transformationValues?: TransformationValues;
  chainId: string;
  verificationStatus: Record<string, boolean>;
}

export default function LibraryTransformations({
  transformations,
  transformationValues,
  chainId,
  verificationStatus,
}: LibraryTransformationsProps) {
  if (!transformations || transformations.length === 0 || !transformationValues?.libraries) {
    return null;
  }

  // Create a map of library ID to its offsets
  const libraryOffsets = transformations
    .filter((t) => t.reason === "library")
    .reduce<Record<string, number[]>>((acc, t) => {
      if (!acc[t.id]) {
        acc[t.id] = [];
      }
      acc[t.id].push(t.offset);
      return acc;
    }, {});

  // Sort libraries by their fully qualified names
  const sortedLibraries = Object.entries(transformationValues.libraries)
    .sort(([idA], [idB]) => idA.localeCompare(idB))
    .map(([id, address]) => ({
      id,
      address,
      offsets: libraryOffsets[id]?.sort((a, b) => a - b) || [],
    }));

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="text-lg font-medium leading-6 text-gray-900 px-6 py-4">Library Transformations</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Fully Qualified Name
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Address
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Byte Offsets
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedLibraries.map(({ id, address, offsets }) => {
              const libraryAddress =
                typeof address === "string" ? address : Object.values(address as Record<string, string>)[0];
              const isVerified = verificationStatus[libraryAddress];

              return (
                <tr key={id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    <div className="flex items-center">
                      {libraryAddress && (
                        <>
                          {isVerified ? (
                            <a
                              href={`/${chainId}/${libraryAddress.toLowerCase()}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {libraryAddress}
                            </a>
                          ) : (
                            <span>{libraryAddress}</span>
                          )}
                          <span className="ml-2">
                            {isVerified ? (
                              <IoCheckmarkCircle
                                className="text-green-600 text-xl"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`${libraryAddress} is verified on Sourcify`}
                              />
                            ) : (
                              <IoCloseCircle
                                className="text-red-600 text-xl"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`${libraryAddress} is not verified on Sourcify`}
                              />
                            )}
                          </span>
                          <CopyToClipboard text={libraryAddress} className="ml-2" />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono">{offsets.join(",")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
