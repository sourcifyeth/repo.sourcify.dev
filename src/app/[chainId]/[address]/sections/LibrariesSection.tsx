import React from "react";
import { TransformationValues } from "@/types/contract";
import CopyToClipboard from "../../../../components/CopyToClipboard";
import { IoCheckmarkCircle, IoCloseCircle, IoWarning } from "react-icons/io5";

interface LibrariesSectionProps {
  compilation: {
    compilerSettings?: {
      libraries?: Record<string, string>;
    };
  };
  runtimeValues?: TransformationValues;
  creationValues?: TransformationValues;
  chainId: string;
  verificationStatus: Record<string, boolean>;
}

function LibraryVerificationStatus({ address, isVerified }: { address: string; isVerified: boolean }) {
  return (
    <span className="ml-2">
      {isVerified ? (
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
  );
}

export default async function LibrariesSection({
  compilation,
  runtimeValues,
  creationValues,
  chainId,
  verificationStatus,
}: LibrariesSectionProps) {
  const compilerLinkedLibraries = Object.entries(compilation?.compilerSettings?.libraries || {}).reduce(
    (acc, [filePath, libraries]) => {
      Object.entries(libraries).forEach(([libName, address]) => {
        acc[`${filePath}:${libName}`] = address;
      });
      return acc;
    },
    {} as Record<string, string>
  );

  const manuallyLinkedLibraries = {
    ...(runtimeValues?.libraries || {}),
    ...(creationValues?.libraries || {}),
  };

  if (Object.keys(compilerLinkedLibraries).length === 0 && Object.keys(manuallyLinkedLibraries).length === 0) {
    return null;
  }

  // Check if there are any unverified libraries
  const hasUnverifiedLibraries = Object.entries({ ...compilerLinkedLibraries, ...manuallyLinkedLibraries }).some(
    ([, address]) => !verificationStatus[address]
  );

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <h3 className="text-xl font-medium leading-6 text-gray-900 px-6 py-4">Libraries</h3>
      {hasUnverifiedLibraries && (
        <div className="px-6 pb-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <IoWarning className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  This contract uses unverified libraries. Libraries can contain arbitrary code and should be verified
                  before interacting with the contract.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        {Object.keys(compilerLinkedLibraries).length > 0 && (
          <div className="px-6 pb-4">
            <h4 className="text-md font-medium text-gray-700 mb-2">Compiler Linked Libraries</h4>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(compilerLinkedLibraries).map(([name, address]) => {
                  const isVerified = verificationStatus[address];
                  return (
                    <tr key={name}>
                      <td className="px-6 py-4 whitespace-nowrap font-sans">{name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        <div className="flex items-center">
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
                          <LibraryVerificationStatus address={address} isVerified={isVerified} />
                          <CopyToClipboard text={address} className="ml-2" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(manuallyLinkedLibraries).length > 0 && (
          <div className="px-6 pb-4">
            <h4 className="text-lg font-medium text-gray-700">Manually Linked Libraries</h4>
            <p className="text-sm text-gray-400 mb-2">
              These libraries are linked manually on the bytecode after the compilation and not by the compiler. See{" "}
              <a
                href="https://docs.soliditylang.org/en/v0.8.29/using-the-compiler.html#library-linking"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Solidity docs
              </a>{" "}
            </p>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Address
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(manuallyLinkedLibraries).map(([name, address]) => {
                  const isVerified = verificationStatus[address];
                  return (
                    <tr key={name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">{name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        <div className="flex items-center">
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
                          <LibraryVerificationStatus address={address} isVerified={isVerified} />
                          <CopyToClipboard text={address} className="ml-2" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
