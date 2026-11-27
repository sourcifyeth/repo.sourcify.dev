"use client";

import { useEffect, useMemo, useState } from "react";
import type { DisplayModel, ExternalDataProvider } from "@ethereum-sourcify/clear-signing";
import { type PreviewTransaction, walletPreview } from "@/utils/interact/clearSigning/registry";
import { readTokenInfo } from "@/utils/interact/clearSigning/token";
import type { TokenStandard } from "@/utils/interact/clearSigning/tokenStandard";
import { useSources } from "./DataSources";

/**
 * The round-trip check of a clear signing form. The page takes the calldata that it built and runs it through
 * the forward direction of the same descriptor (`format()` of the SDK): the result is what a wallet with clear
 * signing shows for this transaction. If "1.5" in the form does not come back as "1.5 USDT" here, the user sees
 * it before they sign. If the SDK cannot format the calldata fully, the block does not show.
 */
export default function WalletPreview({ tx, standard }: { tx: PreviewTransaction; standard: TokenStandard | null }) {
  const sources = useSources();
  const urls = sources.selected.map((endpoint) => endpoint.url).join(" ");
  const currency = sources.chain?.nativeCurrency;
  const chainName = sources.chain?.name;

  // What a wallet knows: token decimals (the same two-endpoint read as the form's amount fields) and the chain's currency
  const provider = useMemo<ExternalDataProvider>(
    () => ({
      resolveToken: async (chainId, address) => {
        if (!urls) return null;
        try {
          const info = await readTokenInfo(chainId, address, urls.split(" "));
          return { name: info.symbol, symbol: info.symbol, decimals: info.decimals };
        } catch {
          return null;
        }
      },
      resolveChainInfo: async () => (currency ? { name: chainName ?? "this chain", nativeCurrency: currency } : null),
    }),
    [urls, currency, chainName]
  );

  const key = `${tx.chainId}:${tx.to}:${tx.data}:${tx.value ?? ""}:${tx.from ?? ""}:${standard}`;
  const [shown, setShown] = useState<{ key: string; display: DisplayModel | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Wait until the user stops typing
    const timer = setTimeout(() => {
      walletPreview(tx, standard, provider).then((display) => {
        if (!cancelled) setShown({ key, display });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` holds every field of the transaction
  }, [key, provider]);

  const display = shown?.key === key ? shown.display : null;
  if (!display) return null;
  const intent = typeof display.intent === "string" ? display.intent : null;
  const rows = (display.fields ?? []).flatMap((field) => ("fields" in field ? field.fields : [field]));
  if (!intent && rows.length === 0) return null;

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <p className="text-gray-500">
        Your wallet should show{intent ? ":" : " these values:"}{" "}
        {intent && <span className="font-medium text-gray-900">{intent}</span>}
      </p>
      {rows.length > 0 && (
        <dl className="mt-1 space-y-0.5">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-x-2">
              <dt className="shrink-0 text-gray-500">{row.label}</dt>
              <dd className="min-w-0 break-all text-gray-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
