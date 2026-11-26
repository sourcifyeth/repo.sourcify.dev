/**
 * Browser wallets for the "Read / Write Contract" section. Wallets are found with EIP-6963 (each
 * installed wallet announces its name and icon); `window.ethereum` is the fallback for old wallets.
 * Sending and waiting for the receipt use viem. Browser wallets only: no WalletConnect.
 */
import { type EIP1193Provider, BaseError, createPublicClient, createWalletClient, custom, numberToHex } from "viem";
import type { CallError } from "./types";

export interface WalletInfo {
  /** Unique per wallet in this page; from EIP-6963, or "injected" for window.ethereum */
  uuid: string;
  name: string;
  /** A data: URI from the wallet itself, or undefined */
  icon?: string;
  provider: EIP1193Provider;
}

interface AnnounceEvent extends Event {
  detail: { info: { uuid: string; name: string; icon?: string; rdns?: string }; provider: EIP1193Provider };
}

type WalletWindow = EventTarget & { ethereum?: EIP1193Provider };

/** How long to wait for EIP-6963 answers before the window.ethereum fallback is used. */
export const DISCOVERY_FALLBACK_MS = 500;

/**
 * Finds the browser wallets and calls `onChange` with the full list each time a wallet announces itself.
 * Returns a function that stops listening.
 */
export function discoverWallets(onChange: (wallets: WalletInfo[]) => void, target?: WalletWindow): () => void {
  const scope = target ?? (typeof window === "undefined" ? undefined : (window as unknown as WalletWindow));
  if (!scope) return () => undefined;
  const wallets = new Map<string, WalletInfo>();
  const onAnnounce = (event: Event) => {
    const { info, provider } = (event as AnnounceEvent).detail ?? {};
    if (!info?.uuid || !provider) return;
    // Only data: icons: an icon URL would make the browser contact a server chosen by the wallet
    const icon = typeof info.icon === "string" && info.icon.startsWith("data:image/") ? info.icon : undefined;
    wallets.set(info.uuid, { uuid: info.uuid, name: info.name || "Browser wallet", icon, provider });
    onChange([...wallets.values()]);
  };
  scope.addEventListener("eip6963:announceProvider", onAnnounce);
  scope.dispatchEvent(new Event("eip6963:requestProvider"));
  const fallback = setTimeout(() => {
    if (wallets.size === 0 && scope.ethereum) {
      wallets.set("injected", { uuid: "injected", name: "Browser wallet", provider: scope.ethereum });
      onChange([...wallets.values()]);
    }
  }, DISCOVERY_FALLBACK_MS);
  return () => {
    clearTimeout(fallback);
    scope.removeEventListener("eip6963:announceProvider", onAnnounce);
  };
}

/** Asks the wallet for an account (the wallet shows its prompt). Returns the account and the wallet's chain. */
export async function connectWallet(provider: EIP1193Provider): Promise<{ account: string; chainId: number }> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("The wallet gave no account");
  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  return { account: accounts[0], chainId: Number.parseInt(chainHex, 16) };
}

/** What `wallet_addEthereumChain` needs, from the Chainlist entry of the chain. */
export interface AddChainParams {
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

/** The error code of a wallet error: on the error itself, or deeper inside a viem error. */
export function walletErrorCode(error: unknown): number | undefined {
  if (error instanceof BaseError) {
    const inner = error.walk((cause) => typeof (cause as { code?: unknown }).code === "number");
    return (inner as { code?: number } | null)?.code;
  }
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "number" ? code : undefined;
}

/**
 * Switches the wallet to the chain. If the wallet does not know the chain (error 4902), it asks the wallet
 * to add it with the given data, which also switches to it. Then it asks the wallet for its chain and
 * returns it: some wallets send no `chainChanged` event after a switch.
 */
export async function switchWalletChain(
  provider: EIP1193Provider,
  chainId: number,
  add?: AddChainParams
): Promise<number> {
  const hex = numberToHex(chainId);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (error) {
    if (!isUnknownChain(error) || !add) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, ...add }] });
  }
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(current, 16);
}

/** A transaction that is in a block: it either ran, or reverted (and its gas was paid). */
export interface MinedTransaction {
  status: "mined";
  /** The hash of the transaction in the block: a replacement (speed up, cancel) has a new hash */
  hash: string;
  block: number;
  gasUsed: string;
  reverted: boolean;
}

/**
 * The result of a send. "unconfirmed": the wallet sent the transaction (it has a hash), but the page
 * got no receipt in time, or the wallet's RPC failed while the page waited. The transaction can still
 * be mined: the page must never offer to send it again.
 */
export type SendResult = MinedTransaction | { status: "unconfirmed"; hash: string; problem: string };

/** The wallet is on another chain than the contract. Thrown before anything is sent. */
export class WrongChainError extends Error {
  constructor(readonly walletChain: number) {
    super(`The wallet is on chain ${walletChain}`);
    this.name = "WrongChainError";
  }
}

/** Waits for the receipt of a sent transaction. Follows a replacement (speed up or cancel in the wallet). */
async function waitMined(provider: EIP1193Provider, hash: `0x${string}`, timeout?: number): Promise<MinedTransaction> {
  const reader = createPublicClient({ transport: custom(provider) });
  let finalHash: string = hash;
  const receipt = await reader.waitForTransactionReceipt({
    hash,
    timeout,
    onReplaced: (replacement) => {
      finalHash = replacement.transaction.hash;
    },
  });
  return {
    status: "mined",
    hash: finalHash,
    block: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
    reverted: receipt.status === "reverted",
  };
}

/**
 * Sends a transaction from the wallet and waits until it is mined. `onHash` runs when the wallet has sent it.
 *
 * 1. Asks the wallet for its chain right before the send, and stops with WrongChainError on another chain.
 *    The page's own state can be old: some wallets do not send "chainChanged".
 * 2. Sends. Errors up to here (rejection, refusal, revert in the gas estimate) are thrown: nothing was sent.
 * 3. Waits for the receipt. A failure from here on returns "unconfirmed" with the hash, and never throws.
 */
export async function sendTransaction(
  provider: EIP1193Provider,
  tx: { from: string; to: string; data: string; value: bigint },
  chainId: number,
  onHash: (hash: string) => void,
  /** How long to wait for the receipt before the result is "unconfirmed" (viem's default: 180 s) */
  { receiptTimeoutMs }: { receiptTimeoutMs?: number } = {}
): Promise<SendResult> {
  const walletChain = Number.parseInt((await provider.request({ method: "eth_chainId" })) as string, 16);
  if (walletChain !== chainId) throw new WrongChainError(walletChain);
  const wallet = createWalletClient({ transport: custom(provider) });
  const hash = await wallet.sendTransaction({
    account: tx.from as `0x${string}`,
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: tx.value,
    // The chain was checked just above; viem's own check would need a full chain definition
    chain: null,
  });
  onHash(hash);
  try {
    return await waitMined(provider, hash, receiptTimeoutMs);
  } catch (error) {
    return { status: "unconfirmed", hash, problem: walletMessage(error) };
  }
}

/**
 * Keeps waiting for an "unconfirmed" transaction: asks for the receipt again after each failed wait.
 * Returns null when `stopped()` becomes true (the user left or reset the form).
 */
export async function watchTransaction(
  provider: EIP1193Provider,
  hash: string,
  stopped: () => boolean,
  { waitMs = 120_000, pauseMs = 15_000 }: { waitMs?: number; pauseMs?: number } = {}
): Promise<MinedTransaction | null> {
  while (!stopped()) {
    try {
      return await waitMined(provider, hash as `0x${string}`, waitMs);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
  return null;
}

/** A wallet error as an error that the page can explain. 4001 is "the user rejected the request" (EIP-1193). */
export function walletError(error: unknown): CallError {
  if (error instanceof WrongChainError) return { kind: "wrong-chain", walletChain: error.walletChain };
  if (walletErrorCode(error) === 4001) return { kind: "wallet-rejected" };
  return { kind: "wallet-error", message: walletMessage(error) };
}

/** The wallet's own words. Some wallets (Rabby) reject with a plain object { code, message }, not an Error. */
export function walletMessage(error: unknown): string {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message) return message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * True if the wallet does not know the chain. EIP-3326 says code 4902; some wallets use another code
 * (for example -32603) with a message such as "Unrecognized chain ID".
 */
export function isUnknownChain(error: unknown): boolean {
  if (walletErrorCode(error) === 4902) return true;
  return /unrecognized chain|unknown chain|chain.*not (been )?added|not added|not supported|no chain|add.*chain first/i.test(
    walletMessage(error)
  );
}

/**
 * The revert data inside a wallet error, if any. Some wallets estimate the gas before they show the
 * prompt, and refuse with the revert data when the call would fail.
 */
export function revertDataOf(error: unknown): string | undefined {
  const hasData = (item: unknown) => {
    const data = (item as { data?: unknown } | null)?.data;
    return typeof data === "string" && /^0x([0-9a-fA-F]{2})*$/.test(data) && data.length >= 10;
  };
  if (error instanceof BaseError) {
    // MetaMask puts the revert data one level down: error.data.data
    const inner = error.walk((item) => hasData(item) || hasData((item as { data?: unknown } | null)?.data));
    if (!inner) return undefined;
    const data = (inner as { data?: unknown }).data;
    return typeof data === "string" ? data : (data as { data: string }).data;
  }
  if (hasData(error)) return (error as { data: string }).data;
  const nested = (error as { data?: { data?: unknown } } | null)?.data;
  return hasData(nested) ? (nested as { data: string }).data : undefined;
}
