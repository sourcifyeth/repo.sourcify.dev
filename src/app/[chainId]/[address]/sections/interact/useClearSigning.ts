"use client";

import { useEffect, useMemo, useState } from "react";
import { type LinkedModel, linkModels } from "@/utils/interact/clearSigning/link";
import { type LoadedModels, type ModelSource, loadInputModels } from "@/utils/interact/clearSigning/registry";
import { type TokenStandard, detectTokenStandard } from "@/utils/interact/clearSigning/tokenStandard";
import type { FunctionSet } from "./useContractFunctions";

/** What a function panel needs for its clear signing form. */
export interface ClearSigning {
  link: LinkedModel;
  /** Where the labels come from: the contract's descriptor in the ERC-7730 registry, or a generic token template */
  source: ModelSource;
  /** The token standard that the page found in the verified ABI, if any (for the SDK's templates) */
  standard: TokenStandard | null;
}

/**
 * The clear signing input models of the contract, linked to the functions that the list shows.
 * A function with a model gets a form with the labels and formats of its ERC-7730 descriptor; every other
 * function keeps its ABI form. The lookup is by the address of the page (for a proxy: the proxy), because a
 * descriptor is bound to the address that a user calls. Nothing here blocks the list: until the models are
 * there, and if they never come, all functions have their ABI forms.
 */
export function useClearSigning(chainId: string, address: string, set: FunctionSet) {
  // A proxy is a token if its implementation is one: wait until the implementation's ABI is there
  const settled = set.implementation.status !== "loading";
  const standard = useMemo(
    () => (settled ? detectTokenStandard(set.logicFunctions.map((fn) => fn.selector)) : null),
    [settled, set.logicFunctions]
  );
  const key = `${chainId}:${address}:${standard}`;
  const [loaded, setLoaded] = useState<{ key: string; result: LoadedModels | null } | null>(null);

  useEffect(() => {
    if (!settled) return;
    let cancelled = false;
    loadInputModels(Number(chainId), address, standard).then((result) => {
      if (!cancelled) setLoaded({ key, result });
    });
    return () => {
      cancelled = true;
    };
  }, [settled, chainId, address, standard, key]);

  const result = loaded?.key === key ? loaded.result : null;
  const linked = useMemo(
    () => (result ? linkModels(result.models, set.functions) : new Map<string, LinkedModel>()),
    [result, set.functions]
  );

  return useMemo(
    () => ({
      count: linked.size,
      of: (fnId: string): ClearSigning | undefined => {
        const link = linked.get(fnId);
        return link && result ? { link, source: result.source, standard } : undefined;
      },
    }),
    [linked, result, standard]
  );
}
