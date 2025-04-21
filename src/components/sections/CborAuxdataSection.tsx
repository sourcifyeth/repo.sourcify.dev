import { Suspense } from "react";
import Image from "next/image";
import { BytecodeData } from "@/types/contract";
import { SolidityDecodedObject } from "@ethereum-sourcify/bytecode-utils";
import { formatCborAuxdata } from "@/utils/format";
import ToggledRawCodeView from "../ToggledRawCodeView";
import LoadingState from "../LoadingState";
import ipfsLogo from "@/assets/ipfs.png";

interface CborAuxdataSectionProps {
  cborAuxdata: BytecodeData["cborAuxdata"];
  language: string;
}

export default function CborAuxdataSection({ cborAuxdata, language }: CborAuxdataSectionProps) {
  if (!cborAuxdata || Object.keys(cborAuxdata).length === 0) {
    return null;
  }

  return (
    <div className="mt-6 ml-2">
      <h3 className="text-xl font-semibold text-gray-800 mt-2">CBOR Auxdata</h3>
      <p className="text-gray-700 mb-2 text-xs">
        These values are what Sourcify extracted from the recompiled bytecode. If these values are different in the
        on-chain bytecode, they will show up in Transformations section.
      </p>
      {Object.entries(cborAuxdata).map(([key, cborAuxdataObj]) => {
        const decodedCborAuxdata = formatCborAuxdata(cborAuxdataObj.value, language);
        return (
          <div key={key} className="mb-4 rounded-lg border border-gray-200 p-4 ml-4">
            <h4 className="text-md font-medium">CBOR Auxdata id: {key}</h4>
            {(decodedCborAuxdata as SolidityDecodedObject)?.ipfs && (
              <div className="my-2">
                <a
                  href={`https://ipfs.io/ipfs/${(decodedCborAuxdata as SolidityDecodedObject).ipfs}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs inline-flex items-center gap-2 shadow-sm rounded-md bg-white border border-gray-300 px-3 py-1 hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
                >
                  View on <Image src={ipfsLogo} alt="IPFS Logo" width={36} height={36} />
                </a>
                <span className="text-gray-700 ml-2 text-sm">
                  Solidity metadata.json IPFS hash:{" "}
                  <span className="font-mono">{(decodedCborAuxdata as SolidityDecodedObject).ipfs}</span>
                </span>
              </div>
            )}
            <Suspense fallback={<LoadingState />}>
              <ToggledRawCodeView
                data1={{
                  name: "Raw",
                  value: cborAuxdataObj.value,
                }}
                data2={{
                  name: "Decoded",
                  value: JSON.stringify(decodedCborAuxdata, null, 2),
                  notBytes: true,
                }}
              />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
