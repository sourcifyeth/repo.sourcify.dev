"use client";

import { ContractData } from "@/types/contract";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";

interface ContractSourceProps {
  contract: ContractData;
}

export default function ContractSource({ contract }: ContractSourceProps) {
  const [activeFile, setActiveFile] = useState<string | null>(Object.keys(contract.sources)[0] || null);
  const [language, setLanguage] = useState<string>("sol");

  const fileNames = Object.keys(contract.sources);

  // Determine language based on file extension
  useEffect(() => {
    if (activeFile) {
      const extension = activeFile.split(".").pop()?.toLowerCase();
      if (extension === "sol") {
        setLanguage("sol");
      } else if (extension === "vy") {
        setLanguage("elixir");
      } else {
        setLanguage("plaintext");
      }
    }
  }, [activeFile]);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <div className="flex flex-col md:flex-row">
          {/* File selector */}
          <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-gray-200">
            <ul className="divide-y divide-gray-200 max-h-60 md:max-h-[500px] overflow-y-auto">
              {fileNames.map((fileName) => (
                <li
                  key={fileName}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 text-sm truncate ${
                    activeFile === fileName ? "bg-gray-100 border-l-4 border-gray-500 font-medium" : ""
                  }`}
                  onClick={() => setActiveFile(fileName)}
                  title={fileName}
                >
                  {fileName}
                </li>
              ))}
            </ul>
          </div>

          {/* Source code display with Monaco editor */}
          <div className="w-full md:w-3/4">
            {activeFile ? (
              <div className="h-[500px]">
                <Editor
                  height="100%"
                  defaultLanguage={language}
                  value={contract.sources[activeFile].content}
                  options={{
                    readOnly: true,
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-500">No source files available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
