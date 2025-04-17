"use client";

import React, { useEffect, useState } from "react";
import { Transformations, TransformationValues } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";
import { IoCheckmarkCircle, IoCloseCircle } from "react-icons/io5";
import { checkVerification } from "@/utils/api";

interface LibraryTransformationsProps {
  transformations?: Transformations;
  transformationValues?: TransformationValues;
  chainId: string;
}

export default function LibraryTransformations({
  transformations,
  transformationValues,
  chainId,
}: LibraryTransformationsProps) {
  // State to store verification status for each library address
  const [verificationStatus, setVerificationStatus] = useState<Record<string, boolean | undefined>>({});

  // Check verification status for all library addresses
  useEffect(() => {
    if (!transformationValues?.libraries) return;

    const libraries = transformationValues.libraries;

    // Create an array of promises to check verification for each library
    const checkAllLibraries = async () => {
      const statuses: Record<string, boolean | undefined> = {};

      // Initialize all addresses with undefined (loading state)
      for (const [, address] of Object.entries(libraries)) {
        if (address) {
          statuses[address] = undefined;
        }
      }
      setVerificationStatus(statuses);

      // Check verification for each address
      for (const [, address] of Object.entries(libraries)) {
        if (address) {
          try {
            statuses[address] = await checkVerification(chainId, address);
            setVerificationStatus({ ...statuses });
          } catch (error) {
            console.error(`Error checking verification for ${address}:`, error);
            statuses[address] = false;
            setVerificationStatus({ ...statuses });
          }
        }
      }
    };

    checkAllLibraries();
  }, [transformationValues, chainId]);

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
              const isVerified = verificationStatus[address];

              return (
                <tr key={id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    <div className="flex items-center">
                      {address && (
                        <>
                          {isVerified ? (
                            <a
                              href={`/${chainId}/${address.toLowerCase()}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {address}
                            </a>
                          ) : (
                            <span>{address}</span>
                          )}
                          <span className="ml-2">
                            {isVerified === undefined ? (
                              <div
                                className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-gray-600"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`Fetching the verification status of ${address}`}
                              />
                            ) : isVerified ? (
                              <IoCheckmarkCircle
                                className="text-green-600 text-xl"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`${address} is verified on Sourcify`}
                              />
                            ) : (
                              <IoCloseCircle
                                className="text-red-600 text-xl"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`${address} is not verified on Sourcify`}
                              />
                            )}
                          </span>
                          <CopyToClipboard text={address} className="ml-2" />
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
