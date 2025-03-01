import { ContractData } from "@/types/contract";
import { useState } from "react";

interface ContractBytecodeProps {
  contract: ContractData;
}

export default function ContractBytecode({ contract }: ContractBytecodeProps) {
  const [activeTab, setActiveTab] = useState<"creation" | "runtime">("creation");
  const [showFullBytecode, setShowFullBytecode] = useState(false);

  const truncateBytecode = (bytecode: string) => {
    if (!bytecode) return "";
    if (showFullBytecode) return bytecode;
    return bytecode.length > 200 ? `${bytecode.substring(0, 200)}...` : bytecode;
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        {/* Tab selector */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              className={`py-3 px-6 text-sm font-medium ${
                activeTab === "creation"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("creation")}
            >
              Creation Bytecode
            </button>
            <button
              className={`py-3 px-6 text-sm font-medium ${
                activeTab === "runtime"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab("runtime")}
            >
              Runtime Bytecode
            </button>
          </nav>
        </div>

        {/* Bytecode content */}
        <div className="p-4">
          {activeTab === "creation" ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Onchain Bytecode</h3>
              <pre className="p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
                {truncateBytecode(contract.creationBytecode.onchainBytecode)}
              </pre>

              <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">Recompiled Bytecode</h3>
              <pre className="p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
                {truncateBytecode(contract.creationBytecode.recompiledBytecode)}
              </pre>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Onchain Bytecode</h3>
              <pre className="p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
                {truncateBytecode(contract.runtimeBytecode.onchainBytecode)}
              </pre>

              <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">Recompiled Bytecode</h3>
              <pre className="p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
                {truncateBytecode(contract.runtimeBytecode.recompiledBytecode)}
              </pre>
            </div>
          )}

          <div className="mt-4">
            <button
              className="text-sm text-blue-600 hover:text-blue-800"
              onClick={() => setShowFullBytecode(!showFullBytecode)}
            >
              {showFullBytecode ? "Show Less" : "Show Full Bytecode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
