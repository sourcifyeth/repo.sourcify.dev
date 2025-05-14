"use client";

import { AbiItem } from "@/types/contract";
import { useState } from "react";
import JsonViewOnlyEditor from "@/components/JsonViewOnlyEditor";

interface ContractAbiProps {
  abi: AbiItem[];
}

export default function ContractAbi({ abi }: ContractAbiProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showJson, setShowJson] = useState(false);
  const [sectionExpanded, setSectionExpanded] = useState(false);

  const toggleExpand = (index: number) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="bg-white shadow overflow-auto text-sm md:text-base rounded-lg">
      <div
        className="px-4 py-3 flex justify-between items-center cursor-pointer border-b border-gray-200"
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <h2 className="text-xl font-semibold text-gray-800">ABI</h2>
        <svg
          className={`h-6 w-6 text-gray-500 transform transition-transform ${sectionExpanded ? "rotate-180" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      {!sectionExpanded && <div className="px-4 py-3 text-sm text-gray-500">Expand to view</div>}

      {sectionExpanded && (
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center">
            <span className={`mr-2 text-sm ${!showJson ? "font-medium" : "text-gray-500"}`}>Formatted</span>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showJson}
                onChange={() => setShowJson(!showJson)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-900 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-200"></div>
            </label>

            <span className={`ml-2 text-sm ${showJson ? "font-medium" : "text-gray-500"}`}>JSON</span>
          </div>

          {showJson ? (
            <JsonViewOnlyEditor data={abi} height="500px" />
          ) : (
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {abi.map((item, index) => (
                  <li key={index} className="px-4 py-3">
                    <div
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => toggleExpand(index)}
                    >
                      <div className="flex items-center">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {item.type}
                        </span>
                        {item.name && <span className="ml-2 text-sm font-medium text-gray-900">{item.name}</span>}
                      </div>
                      <svg
                        className={`h-5 w-5 text-gray-500 transform ${expanded[index] ? "rotate-180" : ""}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>

                    {expanded[index] && (
                      <div className="mt-2 text-sm text-gray-700">
                        {item.inputs && item.inputs.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inputs</h4>
                            <ul className="mt-1 space-y-1">
                              {item.inputs.map((input, inputIndex) => (
                                <li key={inputIndex} className="pl-2 font-mono">
                                  {input.name}: {input.type}
                                  {input.indexed !== undefined && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      {input.indexed ? "(indexed)" : ""}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.outputs && item.outputs.length > 0 && (
                          <div className="mt-2">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outputs</h4>
                            <ul className="mt-1 space-y-1">
                              {item.outputs.map((output, outputIndex) => (
                                <li key={outputIndex} className="pl-2 font-mono">
                                  {output.name ? `${output.name}: ` : ""}
                                  {output.type}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {item.stateMutability && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-gray-500">State Mutability:</span>
                            <span className="ml-1 font-mono">{item.stateMutability}</span>
                          </div>
                        )}

                        {item.payable !== undefined && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-gray-500">Payable:</span>
                            <span className="ml-1 font-mono">{item.payable ? "Yes" : "No"}</span>
                          </div>
                        )}

                        {item.constant !== undefined && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-gray-500">Constant:</span>
                            <span className="ml-1 font-mono">{item.constant ? "Yes" : "No"}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
