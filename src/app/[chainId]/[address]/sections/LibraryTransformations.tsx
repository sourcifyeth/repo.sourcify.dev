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

  const libraryTransformations = transformations
    .sort((a, b) => a.offset - b.offset)
    .filter((transformation) => transformation.reason === "library");

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
                Byte Offsets
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
                Fully Qualified Name
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {libraryTransformations.map((transformation) => {
              const libraries = transformationValues?.libraries || {};
              const libraryAddress = libraries[transformation.id] || "";
              const isVerified = verificationStatus[libraryAddress];

              return (
                // Use offset as id as ids can be shared by multiple transformations
                <tr key={transformation.offset}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{transformation.offset}</td>

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
                            {isVerified === undefined ? (
                              <div
                                className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-gray-600"
                                data-tooltip-id="global-tooltip"
                                data-tooltip-content={`Fetching the verification status of ${libraryAddress}`}
                              />
                            ) : isVerified ? (
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{transformation.id}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
