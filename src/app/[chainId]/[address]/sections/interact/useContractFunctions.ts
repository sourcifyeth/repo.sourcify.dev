"use client";

import { useEffect, useMemo, useState } from "react";
import { type AbiEntry, type AbiSource, type Fn, buildFunctions, isRead } from "@/utils/interact/abi";
import type { CallContext } from "@/utils/interact/types";

/** What the contract page gives the section. All of it is data that the page already has. */
export interface ContractInteractionProps {
  chainId: string;
  chainName: string;
  address: string;
  contractName: string;
  abi: AbiEntry[];
  userdoc?: Record<string, unknown>;
  devdoc?: Record<string, unknown>;
  proxy: {
    isProxy: boolean;
    /** True if the implementation address was found by heuristics (see utils/proxy.ts) */
    heuristic: boolean;
    /** The first implementation. A diamond proxy has more; v1 uses the first (decision D7). */
    implementation?: { address: string; name?: string };
    /** How many implementations the proxy has (more than 1 for a diamond) */
    implementationCount: number;
  };
  /** Public URL of the Sourcify server, to load the ABI of the implementation */
  serverUrl: string;
  /** Warnings of the page that matter before a call, e.g. a runtime-only match or unverified libraries (decision D8) */
  warnings: string[];
}

export type ImplementationState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "verified"; name: string; functions: Fn[]; errors: AbiEntry[] }
  | { status: "unverified" }
  | { status: "failed" };

/** Loads the ABI and NatSpec of the implementation from the Sourcify API. 404 means "not verified". */
function useImplementation(props: ContractInteractionProps): ImplementationState {
  const implementation = props.proxy.isProxy ? props.proxy.implementation : undefined;
  const [state, setState] = useState<ImplementationState>(implementation ? { status: "loading" } : { status: "none" });

  useEffect(() => {
    if (!implementation) return;
    let cancelled = false;
    const url = `${props.serverUrl}/v2/contract/${props.chainId}/${implementation.address}?fields=abi,compilation.name,userdoc,devdoc`;
    fetch(url)
      .then(async (response) => {
        if (response.status === 404) return { status: "unverified" } as const;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as {
          abi?: AbiEntry[] | null;
          compilation?: { name?: string };
          userdoc?: Record<string, unknown>;
          devdoc?: Record<string, unknown>;
        };
        const abi = body.abi ?? [];
        return {
          status: "verified",
          name: implementation.name || body.compilation?.name || "implementation",
          functions: buildFunctions(abi, { userdoc: body.userdoc, devdoc: body.devdoc }, "implementation"),
          errors: abi.filter((entry) => entry.type === "error"),
        } as const;
      })
      .catch((error) => {
        console.error("Could not load the ABI of the implementation:", error);
        return { status: "failed" } as const;
      })
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, [implementation, props.chainId, props.serverUrl]);

  return state;
}

/**
 * The functions to show: for a proxy with a verified implementation, the implementation's functions
 * by default, with a switch to the proxy's own functions (decision D7). Calls always go to the proxy.
 */
export function useContractFunctions(props: ContractInteractionProps, explorerUrl?: string) {
  const implementation = useImplementation(props);
  const [wanted, setSource] = useState<AbiSource>("implementation");

  const own = useMemo(
    () => buildFunctions(props.abi, { userdoc: props.userdoc, devdoc: props.devdoc }, "own"),
    [props.abi, props.userdoc, props.devdoc]
  );

  return useMemo(() => {
    const verified = implementation.status === "verified" ? implementation : null;
    const source: AbiSource = verified && wanted === "implementation" ? "implementation" : "own";
    const functions = source === "implementation" && verified ? verified.functions : own;
    const errorAbi = [...props.abi.filter((entry) => entry.type === "error"), ...(verified?.errors ?? [])];
    const ctx: CallContext = {
      chainId: props.chainId,
      chainName: props.chainName,
      address: props.address,
      contractName: props.contractName,
      explorerUrl,
      implementation: props.proxy.implementation
        ? {
            address: props.proxy.implementation.address,
            name: verified?.name ?? props.proxy.implementation.name ?? "implementation",
            verified: !!verified,
          }
        : undefined,
      errorAbi: errorAbi as unknown as CallContext["errorAbi"],
    };
    return {
      functions,
      reads: functions.filter(isRead),
      writes: functions.filter((fn) => !isRead(fn)),
      source,
      setSource,
      isProxy: props.proxy.isProxy,
      heuristic: props.proxy.heuristic,
      implementationCount: props.proxy.implementationCount,
      implementation,
      implementationVerified: !!verified,
      ctx,
      counts: { own: own.length, implementation: verified?.functions.length ?? 0 },
    };
  }, [implementation, wanted, own, props, explorerUrl]);
}

export type FunctionSet = ReturnType<typeof useContractFunctions>;
