"use client";

import Link from "next/link";
import { useState } from "react";
import CopyToClipboard from "@/components/CopyToClipboard";
import {
  type AbiParam,
  type FormValue,
  arrayOf,
  displayType,
  elementParam,
  groupDigits,
  shiftDecimal,
} from "@/utils/interact/abi";
import type { CallError } from "@/utils/interact/types";
import { NatSpecNote } from "./FunctionRow";
import { Segmented, buttonSmall } from "./ui";

/** A number: all digits in groups of three, a copy button, and for large values a "divide by 10^n" view. */
/** Names of values that hold a time in seconds (deadline, lastUpdateTimestamp, expiry, …) */
const TIME_NAME = /time|deadline|expir|until|since|date|period|^(start|end)|(start|end|updated|created)(at)?$/i;

function IntegerValue({ value, plain = false, name = "" }: { value: string; plain?: boolean; name?: string }) {
  const [decimals, setDecimals] = useState(0);
  const digits = value.replace("-", "").length;
  const number = Number(value);
  // A date only for a value whose name says it is a time: a balance of 1,600 USDC is not a date in 2020
  const looksLikeTime = TIME_NAME.test(name) && number > 1500000000 && number < 2200000000;
  return (
    <span className="flex min-w-0 items-start gap-x-2">
      <span className="min-w-0 break-all font-mono text-[13px] text-gray-900">{shiftDecimal(value, decimals)}</span>
      <CopyToClipboard text={value} />
      {digits > 6 && !looksLikeTime && !plain && (
        // On screens with a mouse the switch shows when the pointer is on the row; on touch screens it always shows
        <span
          className={`ml-auto shrink-0 transition-opacity ${decimals === 0 ? "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/value:opacity-100 [@media(hover:hover)]:group-focus-within/value:opacity-100" : ""}`}
        >
          <Segmented
            label="Divide the number"
            size="sm"
            value={String(decimals)}
            onChange={(next) => setDecimals(Number(next))}
            options={[
              { value: "0", label: "raw" },
              { value: "6", label: "÷10^6" },
              { value: "18", label: "÷10^18" },
            ]}
          />
        </span>
      )}
      {looksLikeTime && (
        <span className="text-sm text-gray-500">
          as a time: {new Date(number * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC
        </span>
      )}
    </span>
  );
}

function LeafValue({
  type,
  value,
  chainId,
  plain,
  name,
}: {
  type: string;
  value: FormValue;
  chainId: string;
  plain?: boolean;
  name?: string;
}) {
  if (type === "bool")
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-gray-900">
        <span className={`h-2 w-2 rounded-full ${value === true ? "bg-green-500" : "bg-gray-400"}`} />
        {value === true ? "true" : "false"}
      </span>
    );
  const text = String(value);
  if (type === "address")
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <Link
          href={`/${chainId}/${text}`}
          className="break-all font-mono text-[13px] text-cerulean-blue-600 hover:underline"
          data-tooltip-id="global-tooltip"
          data-tooltip-content="Open this address on Sourcify"
        >
          {text}
        </Link>
        <CopyToClipboard text={text} />
      </span>
    );
  if (/^u?int\d*$/.test(type)) return <IntegerValue value={text} plain={plain} name={name} />;
  if (type === "string")
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="break-words text-gray-900 [overflow-wrap:anywhere]">“{text}”</span>
        <CopyToClipboard text={text} />
      </span>
    );
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="break-all font-mono text-[13px] text-gray-900">{text}</span>
      <CopyToClipboard text={text} />
      <span className="shrink-0 text-xs text-gray-500">{Math.max(0, (text.length - 2) / 2)} bytes</span>
    </span>
  );
}

/** One returned value. A struct or a list is a tree that opens and closes. */
export function ValueTree({
  param,
  value,
  chainId,
  name,
  doc,
  stacked,
  depth = 0,
}: {
  param: AbiParam;
  value: FormValue;
  chainId: string;
  name: string;
  doc?: string;
  /** Label above the value, for a narrow column */
  stacked?: boolean;
  /** Nesting level in a struct or list. Each level is indented 1rem, and the label column is 1rem narrower, so all values start at the same x. */
  depth?: number;
}) {
  const array = arrayOf(param.type);
  const label = (
    <>
      <span className="font-medium text-gray-800">{name}</span>{" "}
      <span className="ml-1.5 inline-block whitespace-nowrap font-mono text-xs text-gray-500">
        {displayType(param)}
      </span>
    </>
  );

  if (array || param.type === "tuple") {
    const items = Array.isArray(value) ? value : [];
    const children = array
      ? items.map((item, i) => ({ param: elementParam(param), value: item, name: `[${i}]` }))
      : (param.components ?? []).map((component, i) => ({
          param: component,
          value: items[i],
          name: component.name || `field ${i}`,
        }));
    return (
      <details open className="min-w-0 text-sm">
        <summary className="cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500">
          {label}
          <span className="ml-2 text-xs text-gray-500">
            {array ? `${items.length} ${items.length === 1 ? "item" : "items"}` : `${children.length} fields`}
          </span>
        </summary>
        <div className="ml-[3px] mt-1 space-y-1 border-l border-gray-300 pl-3">
          {children.length === 0 && <p className="text-sm text-gray-500">Empty list</p>}
          {children.map((child, i) => (
            <ValueTree key={i} {...child} chainId={chainId} stacked={stacked} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div
      style={{ "--label-w": `calc(15rem - ${depth}rem)` } as React.CSSProperties}
      className={`group/value min-w-0 rounded py-0.5 text-sm leading-5 ${stacked ? "" : "sm:grid sm:grid-cols-[var(--label-w)_minmax(0,1fr)] sm:gap-x-4"}`}
    >
      {/* The type always sits under the name, so every row has the same shape */}
      <div className="min-w-0">
        <span className="block break-words font-medium text-gray-800">{name}</span>
        <span className="block whitespace-nowrap font-mono text-xs text-gray-500">{displayType(param)}</span>
        {doc && <NatSpecNote kind="return" text={doc} className="mt-0.5" />}
      </div>
      <div className="min-w-0">
        <LeafValue type={param.type} value={value} chainId={chainId} plain={stacked} name={name} />
      </div>
    </div>
  );
}

export function RawData({ label, data }: { label: string; data: string }) {
  return (
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500">
        {label} <span className="text-gray-400">({Math.max(0, (data.length - 2) / 2)} bytes)</span>
      </summary>
      <div className="mt-1 flex items-start gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-2">
        <code className="max-h-32 min-w-0 flex-1 overflow-y-auto break-all font-mono text-xs leading-5 text-gray-700">
          {data}
        </code>
        <CopyToClipboard text={data} />
      </div>
    </details>
  );
}

/** A failed call or transaction: what happened, in plain words, with the decoded error if there is one. */
export function ErrorBox({
  error,
  chainName,
  onRetry,
  isWrite,
  explorerUrl,
}: {
  error: CallError;
  chainName: string;
  /** Not given: no "Try again" (after a revert on chain, it would send and pay again) */
  onRetry?: () => void;
  isWrite?: boolean;
  explorerUrl?: string;
}) {
  // A choice of the user, or a refusal of the wallet, is not an error of the contract: use the yellow box
  const isSoft = ["wallet-rejected", "wallet-error", "wrong-chain", "read-error"].includes(error.kind);
  const box = isSoft ? "border-yellow-200 bg-yellow-50 text-yellow-900" : "border-red-200 bg-red-50 text-red-900";
  const reverted = isWrite ? "The transaction would revert, so the wallet did not send it." : "The call reverted.";
  return (
    <div role="alert" className={`min-w-0 rounded-md border p-3 text-sm ${box}`}>
      {error.kind === "custom-error" && (
        <>
          <p className="font-medium">{reverted}</p>
          <p className="mt-1">
            The contract gave the error{" "}
            <code className="rounded bg-white/70 px-1 font-mono font-medium">{error.name}</code>
            <span className="ml-1.5 font-mono text-xs opacity-70">{error.selector}</span>
          </p>
          {error.args.length > 0 && (
            <dl className="mt-2 space-y-1 rounded border border-red-200 bg-white/70 p-2 text-gray-900">
              {error.args.map((arg) => (
                <div key={arg.name} className="sm:grid sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-x-4">
                  <dt>
                    <span className="font-medium">{arg.name}</span>{" "}
                    <span className="font-mono text-xs text-gray-500">{arg.type}</span>
                  </dt>
                  <dd className="min-w-0">
                    {/^u?int\d*$/.test(arg.type) ? (
                      <IntegerValue value={arg.value} />
                    ) : (
                      <span className="break-all font-mono text-[13px]">{arg.value}</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-2">
            <RawData label="Raw revert data" data={error.raw} />
          </div>
        </>
      )}
      {error.kind === "revert-string" && (
        <>
          <p className="font-medium">{reverted}</p>
          <p className="mt-1">
            Reason from the contract: <span className="font-mono">“{error.reason}”</span>
          </p>
          <div className="mt-2">
            <RawData label="Raw revert data" data={error.raw} />
          </div>
        </>
      )}
      {error.kind === "panic" && (
        <>
          <p className="font-medium">{reverted}</p>
          <p className="mt-1">
            The contract stopped with Solidity panic <code className="font-mono">{error.code}</code>: {error.meaning}.
          </p>
        </>
      )}
      {error.kind === "unknown-revert" && (
        <>
          <p className="font-medium">{reverted}</p>
          <p className="mt-1">
            {error.raw === "0x"
              ? "The contract gave no reason."
              : "The contract gave an error that is not in its ABI, so it cannot be decoded here."}
          </p>
          {error.raw !== "0x" && (
            <div className="mt-2">
              <RawData label="Raw revert data" data={error.raw} />
            </div>
          )}
        </>
      )}
      {error.kind === "bad-result" && (
        <>
          <p className="font-medium">The answer does not fit the ABI of this function.</p>
          <p className="mt-1">
            {error.raw === "0x"
              ? `The call returned no data. The contract may not exist at this address on ${chainName}.`
              : "The contract returned data in another shape than its ABI says."}
          </p>
          {error.raw !== "0x" && (
            <div className="mt-2">
              <RawData label="Raw return data" data={error.raw} />
            </div>
          )}
        </>
      )}
      {error.kind === "all-failed" && (
        <>
          <p className="font-medium">No connection to {chainName}.</p>
          <p className="mt-1">The RPC sources did not answer. The contract and your inputs are not the cause.</p>
        </>
      )}
      {error.kind === "reverted-onchain" && (
        <>
          <p className="font-medium">The transaction failed. The contract reverted it.</p>
          <p className="mt-1">
            It was included in block {groupDigits(String(error.block))}, so the gas fee was paid. Nothing else changed.
            The block explorer can show the reason.
          </p>
          <p className="mt-1 break-all font-mono text-xs">{error.hash}</p>
          {explorerUrl && (
            <a
              href={`${explorerUrl}/tx/${error.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block underline"
            >
              View on the block explorer
            </a>
          )}
        </>
      )}
      {error.kind === "wallet-rejected" && (
        <>
          <p className="font-medium">You rejected the transaction in your wallet.</p>
          <p className="mt-1">Nothing was sent. Your inputs are still here.</p>
        </>
      )}
      {error.kind === "wallet-error" && (
        <>
          <p className="font-medium">The wallet did not send the transaction.</p>
          <p className="mt-1 break-words">The wallet said: {error.message}</p>
        </>
      )}
      {error.kind === "wrong-chain" && (
        <>
          <p className="font-medium">Your wallet is on another network. Nothing was sent.</p>
          <p className="mt-1">
            The wallet is on chain {error.walletChain}, and this contract is on {chainName}. Switch the network, then
            write again.
          </p>
        </>
      )}
      {error.kind === "read-error" && (
        <>
          <p className="font-medium">The read could not finish.</p>
          <p className="mt-1 break-words">{error.message}</p>
        </>
      )}
      {onRetry && (
        <button type="button" className={`${buttonSmall} mt-3`} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export { groupDigits };
