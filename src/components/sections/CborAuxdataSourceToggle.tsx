"use client";

import { ReactNode, useState } from "react";
import InfoTooltip from "../InfoTooltip";

type Source = "onchain" | "recompiled";

const TOOLTIP = `The onchain bytecode has different CBOR auxdata than the bytecode Sourcify recompiled from the verified
source files. The auxdata holds the metadata hash, a fingerprint of the source files and compiler settings. A different
hash usually means small changes that don't affect the bytecode, such as comments or file names, so this contract is a
Match and not an Exact Match.<br/><br/><b>Onchain</b>: the values in the deployed bytecode.<br/><b>Recompiled</b>: the
values Sourcify got by compiling the verified source files.`;

const OPTIONS: { value: Source; label: string }[] = [
  { value: "onchain", label: "Onchain" },
  { value: "recompiled", label: "Recompiled" },
];

/**
 * Shown only when the onchain and the recompiled CBOR auxdata differ: switches between
 * the two lists of values, which the server renders.
 */
export default function CborAuxdataSourceToggle({
  onchain,
  recompiled,
}: {
  onchain: ReactNode;
  recompiled: ReactNode;
}) {
  const [source, setSource] = useState<Source>("onchain");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs md:text-sm">
        <div
          role="radiogroup"
          aria-label="CBOR auxdata source"
          className="inline-flex rounded-md border border-gray-300"
        >
          {OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => setSource(value)}
              className={`px-3 py-1 first:rounded-l-md last:rounded-r-md transition-colors ${
                source === value ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-gray-600">The onchain and recompiled values differ</span>
        <InfoTooltip content={TOOLTIP} html={true} />
      </div>
      {source === "onchain" ? onchain : recompiled}
    </div>
  );
}
