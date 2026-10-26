import { Suspense } from "react";
import Image from "next/image";
import { BytecodeData } from "@/types/contract";
import { SolidityDecodedObject } from "@ethereum-sourcify/bytecode-utils";
import { formatCborAuxdata } from "@/utils/format";
import ToggledRawCodeView from "../ToggledRawCodeView";
import LoadingState from "../LoadingState";
import ipfsLogo from "@/assets/ipfs.png";
import { ipfsGatewayUrl } from "@/utils/ipfs";
import CborAuxdataSourceToggle from "./CborAuxdataSourceToggle";

interface CborAuxdataSectionProps {
  cborAuxdata: BytecodeData["cborAuxdata"];
  /** The onchain values where they differ from the recompiled ones (transformationValues.cborAuxdata) */
  onchainCborAuxdata?: Record<string, string>;
  /** Whether this bytecode matched onchain. Without a match there's nothing to compare with. */
  matched: boolean;
  language: string;
  compilerVersion: string;
}

export default function CborAuxdataSection({
  cborAuxdata,
  onchainCborAuxdata,
  matched,
  language,
  compilerVersion,
}: CborAuxdataSectionProps) {
  if (!cborAuxdata || Object.keys(cborAuxdata).length === 0) {
    return null;
  }

  const recompiledValues = Object.fromEntries(Object.entries(cborAuxdata).map(([id, { value }]) => [id, value]));
  const onchainValues = { ...recompiledValues, ...onchainCborAuxdata };
  const valuesDiffer = Object.keys(recompiledValues).some(
    (id) => onchainValues[id].toLowerCase() !== recompiledValues[id].toLowerCase()
  );

  if (!valuesDiffer) {
    return (
      <div className="mt-6 ml-2">
        <h3 className="text-base md:text-lg font-semibold text-gray-800 mt-2">CBOR Auxdata</h3>
        <p className="text-gray-700 mb-2 text-[0.65rem] md:text-xs">
          {matched
            ? "The onchain and the recompiled bytecode have the same CBOR auxdata."
            : "Sourcify extracted these values from the recompiled bytecode."}
        </p>
        <CborAuxdataEntries values={recompiledValues} language={language} compilerVersion={compilerVersion} />
      </div>
    );
  }

  return (
    <div className="mt-6 ml-2">
      <h3 className="text-base md:text-lg font-semibold text-gray-800 mt-2">CBOR Auxdata</h3>
      <CborAuxdataSourceToggle
        onchain={<CborAuxdataEntries values={onchainValues} language={language} compilerVersion={compilerVersion} />}
        recompiled={
          <CborAuxdataEntries values={recompiledValues} language={language} compilerVersion={compilerVersion} />
        }
      />
    </div>
  );
}

function CborAuxdataEntries({
  values,
  language,
  compilerVersion,
}: {
  values: Record<string, string>;
  language: string;
  compilerVersion: string;
}) {
  return (
    <>
      {Object.entries(values).map(([key, value]) => {
        const decodedCborAuxdata = formatCborAuxdata(value, language, compilerVersion);
        return (
          <div key={key} className="mb-4 rounded-lg border border-gray-200 p-2 md:p-4 md:ml-4">
            <h4 className="md:text-base text-sm font-medium">CBOR Auxdata id: {key}</h4>
            {language === "Solidity" && (decodedCborAuxdata as SolidityDecodedObject)?.ipfs && (
              <div className="my-2">
                <a
                  href={`https://ipfs.filebase.io/ipfs/${(decodedCborAuxdata as SolidityDecodedObject).ipfs}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs inline-flex items-center gap-2 shadow-sm rounded-md bg-white border border-gray-300 px-3 py-1 hover:bg-gray-200 transition-colors duration-200 cursor-pointer"
                >
                  View on <Image src={ipfsLogo} alt="IPFS Logo" width={36} height={36} />
                </a>
                <div className="text-gray-700 mt-2 md:mt-0 md:ml-2 text-xs md:text-sm md:inline">
                  Solidity metadata.json IPFS hash:{" "}
                  <span className="font-mono break-all">{(decodedCborAuxdata as SolidityDecodedObject).ipfs}</span>
                </div>
              </div>
            )}
            <Suspense fallback={<LoadingState />}>
              <ToggledRawCodeView
                data1={{
                  name: "Raw",
                  value,
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
    </>
  );
}
