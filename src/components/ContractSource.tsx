import { ContractData } from "@/types/contract";
import { useState } from "react";

interface ContractSourceProps {
  contract: ContractData;
}

export default function ContractSource({ contract }: ContractSourceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(Object.keys(contract.sources)[0] || null);

  const fileNames = Object.keys(contract.sources);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <div className="flex">
          {/* File selector */}
          <div className="w-1/4 border-r border-gray-200">
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {fileNames.map((fileName) => (
                <li
                  key={fileName}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm ${
                    activeFile === fileName ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  }`}
                  onClick={() => setActiveFile(fileName)}
                >
                  {fileName}
                </li>
              ))}
            </ul>
          </div>

          {/* Source code display */}
          <div className="w-3/4 overflow-x-auto">
            {activeFile ? (
              <pre className="p-4 text-sm font-mono text-gray-800 whitespace-pre overflow-x-auto max-h-96 overflow-y-auto">
                {contract.sources[activeFile].content}
              </pre>
            ) : (
              <div className="p-4 text-sm text-gray-500">No source files available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
