import type { Tracking } from "./chainRpcs";
import type { FormValue } from "./abi";

/** An RPC endpoint that a read can ask: one from Chainlist, or a URL that the user entered. */
export interface RpcEndpoint {
  /** The URL; unique in the list */
  id: string;
  host: string;
  url: string;
  tracking: Tracking;
  kind: "public" | "custom";
}

/** What one endpoint answered to a read call. */
export interface SourceResult {
  endpoint: RpcEndpoint;
  ms: number;
  ok: boolean;
  /** Why the endpoint gave no answer */
  problem?: string;
  /** The raw return data, or the revert data */
  raw?: string;
}

/** What the calls of one function need to know about the contract and the chain. */
export interface CallContext {
  chainId: string;
  chainName: string;
  /** The address that gets every call: for a proxy, the proxy */
  address: string;
  contractName: string;
  /** Base URL of a block explorer of the chain, or undefined */
  explorerUrl?: string;
  implementation?: { address: string; name: string; verified: boolean };
  /** The error definitions of the contract's ABIs (own and implementation), to decode reverts */
  errorAbi: ReadonlyArray<Record<string, unknown>>;
}

export type CallError =
  | {
      kind: "custom-error";
      name: string;
      selector: string;
      args: Array<{ name: string; type: string; value: string }>;
      raw: string;
    }
  | { kind: "revert-string"; reason: string; raw: string }
  | { kind: "panic"; code: string; meaning: string; raw: string }
  /** The contract reverted with data that no known error matches, or with no data */
  | { kind: "unknown-revert"; raw: string }
  | { kind: "all-failed"; sources: SourceResult[] }
  | { kind: "wallet-rejected" }
  /** The call returned data that does not fit the ABI, e.g. "0x" because there is no contract at the address */
  | { kind: "bad-result"; raw: string }
  /** The wallet or its RPC refused the request; the message comes from the wallet */
  | { kind: "wallet-error"; message: string }
  /** No simulation before sending (decision D6): a transaction that reverts is mined, fails, and its gas is spent */
  | { kind: "reverted-onchain"; hash: string; block: number };

/** One side of a mismatch: the values that one endpoint returned, or the revert it gave. */
export interface MismatchSide {
  host: string;
  values?: FormValue[];
  error?: CallError;
}

export type CallOutcome =
  | {
      status: "success";
      values: FormValue[];
      raw: string;
      block: number;
      at: number;
      sources: SourceResult[];
      /**
       * agree: two endpoints gave the same data. mismatch: they gave different data.
       * single: only one endpoint was asked. one-failed: two were asked, one gave no answer.
       */
      check: "agree" | "mismatch" | "single" | "one-failed";
      /** For a mismatch: what each endpoint gave */
      sides?: MismatchSide[];
    }
  | { status: "error"; error: CallError; at: number; block?: number; sources?: SourceResult[] };

export type TxState =
  | { step: "idle" }
  | { step: "wallet" }
  | { step: "pending"; hash: string }
  | { step: "confirmed"; hash: string; block: number; gasUsed: string }
  | { step: "failed"; error: CallError };
