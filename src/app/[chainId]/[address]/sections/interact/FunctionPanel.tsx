"use client";

import type { EIP1193Provider } from "viem";
import { copyText } from "@/utils/clipboard";
import { useEffect, useRef, useState } from "react";
import { FiExternalLink } from "react-icons/fi";
import { IoCheckmarkCircle, IoRefresh } from "react-icons/io5";
import CopyToClipboard from "@/components/CopyToClipboard";
import {
  type Fn,
  type FormValue,
  arrayOf,
  checkForm,
  emptyValue,
  encodeCall,
  groupDigits,
  isRead,
  scaleDecimal,
  shiftDecimal,
} from "@/utils/interact/abi";
import { decodeRevert } from "@/utils/interact/decode";
import { proxyAdmin } from "@/utils/interact/proxyAdmin";
import { readFunction } from "@/utils/interact/read";
import type { CallContext, CallError, CallOutcome, RpcEndpoint, TxState } from "@/utils/interact/types";
import {
  type MinedTransaction,
  WrongChainError,
  revertDataOf,
  sendTransaction,
  walletError,
  watchTransaction,
} from "@/utils/interact/wallet";
import { GapNote, Provenance, SourcesFailed, useSources } from "./DataSources";
import ParamField, { Field } from "./ParamField";
import { ErrorBox, RawData, ValueTree } from "./ResultView";
import { SafetyLine, useWallet } from "./Wallet";
import {
  Spinner,
  buttonGhost,
  buttonOutline,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  inputClass,
  selectClass,
  textareaClass,
} from "./ui";

interface FunctionPanelProps {
  fn: Fn;
  ctx: CallContext;
  /** Read at once, without a click on the read button: for an opened read function that has no inputs (decision D5) */
  autoRead?: boolean;
}

const ETH_UNITS = { wei: 0, gwei: 9, ether: 18 } as const;
type EthUnit = keyof typeof ETH_UNITS;

/** The form, the action buttons and the result of one function. */
export default function FunctionPanel({ fn, ctx, autoRead }: FunctionPanelProps) {
  const sources = useSources();
  const wallet = useWallet();
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<FormValue[]>(() => fn.inputs.map(emptyValue));
  const [ethText, setEthText] = useState("");
  const [ethUnit, setEthUnit] = useState<EthUnit>("ether");
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [tx, setTx] = useState<TxState>({ step: "idle" });
  // The admin address that the last read used as sender, for a proxy's own function (see utils/interact/proxyAdmin.ts)
  const [readAs, setReadAs] = useState<string | null>(null);
  const isProxyOwn = fn.source === "own" && !!ctx.implementation;

  const read = isRead(fn);
  const payable = fn.mutability === "payable";
  const check = checkForm(fn.inputs, values);
  const wei = ethText.trim() === "" ? "0" : scaleDecimal(ethText, ETH_UNITS[ethUnit]);
  const valueError = wei === null || wei.startsWith("-");
  // The value in the chain's own currency (ETH on Ethereum), not in wei
  const nativeAmount = `${shiftDecimal(wei ?? "0", 18)} ${sources.chain?.nativeCurrency?.symbol ?? "ETH"}`;
  const ready = check.missing === 0 && check.invalid === 0 && !valueError;
  const calldata = ready ? encodeCall(fn, values) : null;
  // An unconfirmed transaction counts as busy: Write stays off, so that the same transaction is not sent twice
  const busy = loading || tx.step === "wallet" || tx.step === "pending" || tx.step === "unconfirmed";
  // A struct or list result, and the two answers of a mismatch, may use the full width; everything else keeps the form's right edge
  const wideResult =
    outcome?.status === "success" &&
    (outcome.check === "mismatch" || fn.outputs.some((output) => output.type === "tuple" || !!arrayOf(output.type)));

  const notReady =
    check.invalid > 0 || valueError
      ? `${check.invalid + (valueError ? 1 : 0)} ${check.invalid + (valueError ? 1 : 0) === 1 ? "field has" : "fields have"} a problem`
      : check.missing > 0
        ? `${check.missing} ${check.missing === 1 ? "field is" : "fields are"} empty`
        : null;

  // A read asks the selected endpoints (two if possible). It sends no sender: the connected wallet's
  // address would go to the public RPCs for nothing. Only a transparent proxy's own functions read as its admin.
  const call = async (endpoints: RpcEndpoint[] = sources.selected) => {
    if (endpoints.length === 0) return;
    setLoading(true);
    try {
      // A transparent proxy answers its own functions only for its admin: read as the admin if the proxy has one
      const admin = isProxyOwn
        ? await proxyAdmin(
            ctx.chainId,
            ctx.address,
            endpoints.map((endpoint) => endpoint.url)
          )
        : null;
      setReadAs(admin);
      const sender = admin ?? undefined;
      let result = await readFunction(fn, values, ctx, endpoints, sender);
      // A source that failed is swapped for the next working one, and the read runs once more
      const failedIds = (
        result.status === "error" && result.error.kind === "all-failed" ? result.error.sources : (result.sources ?? [])
      )
        .filter((source) => !source.ok)
        .map((source) => source.endpoint.id);
      if (failedIds.length > 0) {
        const next = sources.replaceFailed(failedIds);
        if (next) result = await readFunction(fn, values, ctx, next, sender);
      }
      setOutcome(result);
    } catch (error) {
      // A bug or a value that cannot be encoded: say so, instead of a silent button
      setOutcome({
        status: "error",
        at: Date.now(),
        error: { kind: "read-error", message: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      setLoading(false);
    }
  };

  // A new result can be below the bottom of the window: scroll the page just enough to show it
  useEffect(() => {
    const result = resultRef.current;
    if (!result || result.offsetParent === null || (!outcome && tx.step === "idle")) return;
    const below = result.getBoundingClientRect().bottom + 12 - window.innerHeight;
    if (below > 0) window.scrollBy({ top: below, behavior: "smooth" });
  }, [outcome, tx.step]);

  // An opened read function without inputs reads at once (one time; "Read again" refreshes it)
  const canAutoRead = !!autoRead && read && fn.inputs.length === 0 && sources.selected.length > 0;
  useEffect(() => {
    if (canAutoRead && !outcome && !loading) call();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRead]);

  const minedState = (mined: MinedTransaction): TxState =>
    mined.reverted
      ? { step: "failed", error: { kind: "reverted-onchain", hash: mined.hash, block: mined.block } }
      : { step: "confirmed", hash: mined.hash, block: mined.block, gasUsed: mined.gasUsed };

  // The wallet that sent the last transaction: an unconfirmed one is watched through it
  const sentWith = useRef<EIP1193Provider | null>(null);
  // Each send gets a number. "Dismiss" moves the number on, so that a late answer of an old send is ignored
  const txRun = useRef(0);

  // No simulation before sending (decision D6): the wallet opens at once
  const send = async () => {
    const connection = wallet.connection;
    if (!connection || !wallet.ready || !calldata) return;
    const run = ++txRun.current;
    const update = (state: TxState) => txRun.current === run && setTx(state);
    setTx({ step: "wallet" });
    sentWith.current = connection.wallet.provider;
    try {
      const sent = await sendTransaction(
        connection.wallet.provider,
        { from: connection.account, to: ctx.address, data: calldata, value: BigInt(wei ?? "0") },
        Number(ctx.chainId),
        (hash) => update({ step: "pending", hash })
      );
      // Sent, but no receipt yet: keep watching (below); never offer to send it again
      update(
        sent.status === "unconfirmed"
          ? { step: "unconfirmed", hash: sent.hash, problem: sent.problem }
          : minedState(sent)
      );
    } catch (error) {
      // Nothing was sent. The wallet is on another chain: the page shows "Switch to …" again
      if (error instanceof WrongChainError) wallet.noteWalletChain(error.walletChain);
      // Some wallets estimate the gas first and refuse a call that would revert: explain the revert
      const revertData = revertDataOf(error);
      update({ step: "failed", error: revertData ? decodeRevert(revertData, ctx.errorAbi) : walletError(error) });
    }
  };

  // An unconfirmed transaction: ask for its receipt again until it comes, or until the user dismisses the note
  const unconfirmedHash = tx.step === "unconfirmed" ? tx.hash : null;
  useEffect(() => {
    const provider = sentWith.current;
    if (!unconfirmedHash || !provider) return;
    let stopped = false;
    watchTransaction(provider, unconfirmedHash, () => stopped).then((mined) => {
      if (mined && !stopped) setTx(minedState(mined));
    });
    return () => {
      stopped = true;
    };
  }, [unconfirmedHash]);

  // Reset clears the form. A transaction that is still on its way keeps its note and its watch (see dismiss)
  const reset = () => {
    setValues(fn.inputs.map(emptyValue));
    setEthText("");
    setOutcome(null);
    if (!["wallet", "pending", "unconfirmed"].includes(tx.step)) setTx({ step: "idle" });
  };

  // Hides the note of a pending or unconfirmed transaction and stops watching it. It does not cancel the transaction.
  const dismiss = () => {
    txRun.current++;
    setTx({ step: "idle" });
  };

  const tryAnother = (id: string) => {
    const next = sources.replace(id);
    if (next) call(next);
  };

  const explorerTx = (hash: string) =>
    ctx.explorerUrl ? (
      <a
        href={`${ctx.explorerUrl}/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-cerulean-blue-600 hover:underline"
      >
        View on the block explorer <FiExternalLink className="h-3 w-3" />
      </a>
    ) : null;

  const noSource = read && sources.status !== "loading" && sources.selected.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-6 *:max-w-4xl">
      <form
        className="flex max-w-none! flex-col gap-5 *:max-w-4xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || busy) return;
          if (read) call();
          else send();
        }}
      >
        {fn.inputs.map((input, index) => (
          <ParamField
            key={index}
            param={input}
            value={values[index]}
            onChange={(next) => setValues((current) => current.map((value, i) => (i === index ? next : value)))}
            doc={fn.paramDocs[input.name]}
            fallbackName={`input ${index}`}
          />
        ))}

        {payable && (
          <Field htmlFor={`${fn.id}-value`} name="Value to send" type="payable">
            <div className="flex gap-2">
              <input
                id={`${fn.id}-value`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={ethText}
                placeholder="0"
                aria-invalid={valueError}
                onChange={(e) => setEthText(e.target.value)}
                className={`${inputClass} ${valueError ? "border-red-400" : "border-gray-300"}`}
              />
              <select
                aria-label="Unit of the value"
                value={ethUnit}
                onChange={(e) => setEthUnit(e.target.value as EthUnit)}
                className={`${selectClass} w-[5.75rem]`}
              >
                {Object.keys(ETH_UNITS).map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
            </div>
            {valueError ? (
              <p className="mt-1 text-sm leading-5 text-red-700">
                {ethUnit === "wei"
                  ? "Enter a whole number of wei."
                  : `Enter a positive amount with at most ${ETH_UNITS[ethUnit]} decimal places.`}
              </p>
            ) : (
              ethText.trim() !== "" && (
                <p className="mt-1 text-sm leading-5 text-gray-500">
                  Sent value: <span className="break-all font-mono">{nativeAmount}</span>
                </p>
              )
            )}
          </Field>
        )}

        {/* Writes: what the wallet will get, before the user sends it */}
        {!read && calldata && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium text-gray-700">Transaction preview</span>
              <span className="text-gray-500">{(calldata.length - 2) / 2} bytes of calldata</span>
            </div>
            <dl className="space-y-1">
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 text-gray-500">To</dt>
                <dd className="min-w-0 break-all font-mono text-gray-900">{ctx.address}</dd>
              </div>
              {payable && (
                <div className="flex gap-2">
                  <dt className="w-10 shrink-0 text-gray-500">Value</dt>
                  <dd
                    className="min-w-0 break-all font-mono text-gray-900"
                    data-tooltip-id="global-tooltip"
                    data-tooltip-content={`${groupDigits(wei ?? "0")} wei`}
                  >
                    {nativeAmount}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-10 shrink-0 pt-1.5 text-gray-500">Data</dt>
                <dd className="flex min-w-0 flex-1 items-start gap-2">
                  {/* A read-only box, as a bytes input looks: the calldata is one hex value */}
                  <textarea
                    readOnly
                    aria-label="Calldata (bytes)"
                    value={calldata}
                    rows={Math.min(4, Math.ceil(calldata.length / 64))}
                    className={`${textareaClass} block resize-none border-gray-300 bg-white break-all`}
                  />
                  <span className="pt-1.5">
                    <CopyToClipboard text={calldata} />
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {read ? (
            <button type="submit" className={buttonOutline} disabled={!ready || busy || sources.selected.length === 0}>
              {loading && <Spinner className="h-3.5 w-3.5" />}
              {sources.status === "loading"
                ? "Loading data sources…"
                : loading
                  ? "Reading…"
                  : outcome
                    ? "Read again"
                    : "Read"}
            </button>
          ) : !wallet.connection ? (
            // One place to connect: the wallet button at the top right of the section
            <>
              <button
                type="button"
                className={buttonPrimary}
                disabled
                data-tooltip-id="global-tooltip"
                data-tooltip-content="Connect a wallet at the top right of this section to write"
              >
                Write
              </button>
              <span className="text-sm text-gray-500">Connect a wallet at the top right to write.</span>
            </>
          ) : !wallet.ready ? (
            <button type="button" className={buttonPrimary} onClick={wallet.switchChain}>
              Switch to {plainChainName(ctx.chainName)}
            </button>
          ) : (
            <button type="submit" className={buttonPrimary} disabled={!ready || busy}>
              {busy && <Spinner className="h-3.5 w-3.5" />}
              {tx.step === "wallet"
                ? "Confirm in your wallet…"
                : tx.step === "pending" || tx.step === "unconfirmed"
                  ? "Waiting for confirmation…"
                  : "Write"}
            </button>
          )}
          {!read && (
            <button
              type="button"
              className={buttonSecondary}
              disabled={!calldata}
              data-tooltip-id={calldata ? undefined : "global-tooltip"}
              data-tooltip-content="Fill the form first"
              onClick={async () => {
                if (!calldata) return;
                // If the browser refuses, say so: the preview above still has the text to select by hand
                setCopied((await copyText(calldata)) ? "done" : "failed");
                setTimeout(() => setCopied(null), 1500);
              }}
            >
              {copied === "done" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy calldata"}
            </button>
          )}
          {(fn.inputs.length > 0 || payable) && (
            <button type="button" className={buttonGhost} onClick={reset}>
              Reset
            </button>
          )}
          {notReady && <span className="hidden text-sm text-gray-500 sm:inline">{notReady}</span>}
          {!read && wallet.connection && !wallet.ready && (
            <span className="text-sm text-yellow-700">Your wallet is on another network.</span>
          )}
        </div>

        {!read && (
          <div className="-mt-3">
            <SafetyLine />
          </div>
        )}
        {noSource && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            <p className="font-medium">No data source for {plainChainName(ctx.chainName)}.</p>
            <p className="mt-1">
              {sources.status === "failed"
                ? "The list of public RPC endpoints could not be loaded."
                : "No public RPC endpoint is selected for this chain."}{" "}
              To read, choose one, or enter a custom RPC URL.
            </p>
            <button type="button" className={`${buttonSecondary} mt-2`} onClick={sources.show}>
              Choose data sources
            </button>
          </div>
        )}
      </form>

      {/* Everything after the form: the result. A struct result can be as wide as the box. */}
      <div
        ref={resultRef}
        // An old result does not stay under the "No data source" note
        hidden={noSource}
        className={`${wideResult ? "max-w-none!" : ""} scroll-my-3 space-y-3 empty:hidden`}
      >
        {readAs && outcome && (
          <p className="text-sm leading-5 text-gray-600">
            Read as the proxy admin <span className="font-mono text-[13px]">{readAs}</span>. This proxy answers its own
            functions only for its admin; for anyone else it forwards the call to the implementation.
          </p>
        )}
        {/* Read result */}
        {outcome?.status === "success" && outcome.check === "mismatch" && (
          <div role="alert" className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2.5">
            <p className="text-sm font-medium text-yellow-900">
              The two sources gave different answers. Do not rely on either value.
            </p>
            <p className="mt-0.5 text-sm text-yellow-900">
              One provider can be some blocks behind, or one answer can be wrong. Sourcify cannot tell which.
            </p>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {(outcome.sides ?? []).map((side) => (
                <div key={side.host} className="min-w-0 rounded-md border border-yellow-200 bg-white px-3 py-2">
                  <p className="mb-1 break-all font-mono text-xs text-gray-600">{side.host}</p>
                  {side.values ? (
                    <div className="space-y-1">
                      {fn.outputs.map((output, i) => (
                        <ValueTree
                          key={i}
                          param={output}
                          value={side.values![i]}
                          chainId={ctx.chainId}
                          name={outputLabel(fn, i).name}
                          stacked
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">{side.error ? errorSummary(side.error) : "No answer"}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={buttonSmall}
                onClick={() => {
                  const next = sources.replace(outcome.sources[1]?.endpoint.id ?? "");
                  if (next) call(next);
                  else sources.show();
                }}
              >
                Try another RPC
              </button>
              <button type="button" className={buttonSmall} onClick={sources.show}>
                Choose read data sources
              </button>
              <span className="text-sm text-yellow-900">
                Both read at block <span className="font-mono text-[13px]">{groupDigits(String(outcome.block))}</span>
              </span>
            </div>
            {outcome.gap && <GapNote gap={outcome.gap} block={outcome.block} className="mt-2" />}
          </div>
        )}
        {outcome?.status === "success" && outcome.check !== "mismatch" && (
          <div
            className={`space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 ${loading ? "opacity-50" : ""}`}
          >
            {fn.outputs.length === 0 ? (
              <p className="text-sm text-gray-600">The function returns no value.</p>
            ) : (
              <div className="space-y-1">
                {fn.outputs.map((output, i) => {
                  const label = outputLabel(fn, i);
                  return (
                    <ValueTree
                      key={i}
                      param={output}
                      value={outcome.values[i]}
                      chainId={ctx.chainId}
                      name={label.name}
                      doc={label.doc}
                    />
                  );
                })}
              </div>
            )}
            <RawData label="Raw return data" data={outcome.raw} />
            <Provenance
              check={outcome.check}
              sources={outcome.sources}
              block={outcome.block}
              gap={outcome.gap}
              onTryAnother={tryAnother}
            />
          </div>
        )}
        {outcome?.status === "error" &&
          (outcome.error.kind === "all-failed" ? (
            <SourcesFailed sources={outcome.error.sources} onRetry={() => call()} />
          ) : (
            <div className="space-y-2">
              <ErrorBox error={outcome.error} chainName={ctx.chainName} onRetry={() => call()} />
              {isProxyOwn &&
                !readAs &&
                ["unknown-revert", "custom-error", "revert-string"].includes(outcome.error.kind) && (
                  <p className="text-sm leading-5 text-gray-600">
                    This is a function of the proxy itself. Many proxies answer their own functions only for their
                    admin, and forward every other call to the implementation, which does not have this function.
                    Sourcify did not find the admin of this proxy in the known storage slots.
                  </p>
                )}
              {outcome.sources && (
                <Provenance
                  check={
                    outcome.sources.length === 1
                      ? "single"
                      : outcome.sources.every((source) => source.ok)
                        ? "agree"
                        : "one-failed"
                  }
                  sources={outcome.sources}
                  block={outcome.block}
                  gap={outcome.gap}
                  onTryAnother={tryAnother}
                />
              )}
            </div>
          ))}

        {/* Write result */}
        {tx.step === "pending" && (
          <div role="status" className="rounded-md border border-cerulean-blue-200 bg-cerulean-blue-100/50 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-gray-900">
              <Spinner className="h-3.5 w-3.5 text-cerulean-blue-500" /> Transaction sent. Waiting for confirmation.
            </p>
            <TxHash hash={tx.hash} />
            <p className="mt-1 text-sm">{explorerTx(tx.hash)}</p>
            <DismissButton onClick={dismiss} />
          </div>
        )}
        {tx.step === "unconfirmed" && (
          <div role="status" className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
            <p className="flex items-center gap-2 font-medium">
              <Spinner className="h-3.5 w-3.5 text-yellow-700" /> Sent, but not confirmed yet.
            </p>
            <p className="mt-1">
              Your wallet sent the transaction, but no receipt came in time. It can still be included in a block. Do not
              send it again: check its status on the block explorer or in your wallet. This page keeps checking.
            </p>
            <p className="mt-1 break-words text-xs opacity-80">Last problem: {tx.problem}</p>
            <TxHash hash={tx.hash} />
            <p className="mt-1 text-sm">{explorerTx(tx.hash)}</p>
            <DismissButton onClick={dismiss} />
          </div>
        )}
        {tx.step === "confirmed" && (
          <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-green-900">
              <IoCheckmarkCircle className="h-4 w-4 text-green-600" /> Confirmed in block{" "}
              {groupDigits(String(tx.block))}
            </p>
            <TxHash hash={tx.hash} />
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-gray-600">
              <span>Gas used: {groupDigits(tx.gasUsed)}</span>
              {explorerTx(tx.hash)}
            </p>
            <button type="button" className={`${buttonSmall} mt-2`} onClick={() => setTx({ step: "idle" })}>
              <IoRefresh className="h-3.5 w-3.5" /> Send another
            </button>
          </div>
        )}
        {tx.step === "failed" && (
          <>
            <ErrorBox
              error={tx.error}
              chainName={ctx.chainName}
              // Only errors before the wallet sent anything offer "Try again". After a revert on chain it would send and
              // pay again; on the wrong chain the page shows "Switch to …" instead
              onRetry={["reverted-onchain", "wrong-chain"].includes(tx.error.kind) ? undefined : send}
              isWrite
              explorerUrl={ctx.explorerUrl}
            />
            {isProxyOwn && ["unknown-revert", "reverted-onchain"].includes(tx.error.kind) && (
              <p className="text-sm leading-5 text-gray-600">
                This is a function of the proxy itself. Many proxies run their own functions only when their admin sends
                the transaction, and forward every other call to the implementation.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Hides the note of a transaction that is on its way, and stops watching it. The transaction itself goes on. */
function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${buttonSmall} mt-2`}
      onClick={onClick}
      data-tooltip-id="global-tooltip"
      data-tooltip-content="Hide this note and stop watching. This does not cancel the transaction."
    >
      Dismiss
    </button>
  );
}

function TxHash({ hash }: { hash: string }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-gray-700">
      <span className="shrink-0 text-gray-500">Transaction</span>
      <span className="min-w-0 break-all font-mono">{hash}</span>
      <CopyToClipboard text={hash} />
    </p>
  );
}

/** One line for an error in a mismatch card. */
function errorSummary(error: CallError): string {
  switch (error.kind) {
    case "custom-error":
      return `Reverted with ${error.name}`;
    case "revert-string":
      return `Reverted: “${error.reason}”`;
    case "panic":
      return `Panic ${error.code}: ${error.meaning}`;
    case "bad-result":
      return "Returned data that does not fit the ABI";
    default:
      return "Reverted without a known reason";
  }
}

/**
 * The label of a returned value. NatSpec @return text starts with the name of the value
 * ("balance The fiat token balance"). If the ABI has no name for the output, take that word as its name.
 */
function outputLabel(fn: Fn, i: number): { name: string; doc?: string } {
  const output = fn.outputs[i];
  const doc = fn.returnDocs[output.name || `_${i}`];
  const fallback = fn.outputs.length === 1 ? "result" : `output ${i}`;
  // "balance The fiat token balance": the first word is the name if it looks like an identifier, i.e. it starts
  // with a lower-case letter or "_" ("The allowance …" starts with an English word, not a name)
  const match = doc ? /^([a-z_][A-Za-z0-9_]*)\s+([\s\S]+)$/.exec(doc) : null;
  if (output.name) return { name: output.name, doc: match && match[1] === output.name ? match[2] : doc };
  if (match) return { name: match[1], doc: match[2] };
  return { name: fallback, doc };
}

/** "Ethereum Mainnet (1)" → "Ethereum Mainnet": the same name on every button and note */
export const plainChainName = (name: string) => name.replace(/ \(\d+\)$/, "");
