"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  IoLogOutOutline,
  IoShieldCheckmarkOutline,
  IoWalletOutline,
  IoWarning,
  IoWarningOutline,
} from "react-icons/io5";
import { shortHex } from "@/utils/interact/abi";
import {
  type AddChainParams,
  type WalletInfo,
  connectWallet,
  discoverWallets,
  isUnknownChain,
  switchWalletChain,
  walletError,
} from "@/utils/interact/wallet";
import { useSources } from "./DataSources";
import { plainChainName } from "./FunctionPanel";
import { buttonPrimary, buttonSecondary } from "./ui";

/** The short terms of use of this feature (src/app/write-contract-terms) */
export const TERMS_PATH = "/write-contract-terms";

/* ------------------------------------------------------------------ state */

interface Connection {
  wallet: WalletInfo;
  account: string;
  chainId: number;
}

interface WalletContextValue {
  /** The browser wallets that the page found */
  wallets: WalletInfo[];
  connection: Connection | null;
  /** True if a wallet is connected and on the chain of the contract */
  ready: boolean;
  connect: (wallet: WalletInfo) => Promise<void>;
  disconnect: () => void;
  /** Switches the wallet to the chain of the contract, and adds the chain if the wallet does not know it */
  switchChain: () => Promise<void>;
  /** The wallet said at send time that it is on this chain: update the state (some wallets send no "chainChanged") */
  noteWalletChain: (chainId: number) => void;
  /** The last problem with connecting or switching, for the user */
  problem: string | null;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet needs a WalletProvider");
  return value;
}

/** The connected browser wallet for the whole section. Nothing connects until the user picks a wallet. */
export function WalletProvider({ chainId, children }: { chainId: string; children: React.ReactNode }) {
  const { chain } = useSources();
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Wallets announce themselves only when asked; this does not connect or ask the user anything
  useEffect(() => discoverWallets(setWallets), []);

  // Follow account and chain changes in the wallet
  useEffect(() => {
    if (!connection) return;
    const provider = connection.wallet.provider;
    const onAccounts = (accounts: string[]) =>
      setConnection((current) => (current && accounts[0] ? { ...current, account: accounts[0] } : null));
    const onChain = (chainHex: string) =>
      setConnection((current) => (current ? { ...current, chainId: Number.parseInt(chainHex, 16) } : null));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
    };
  }, [connection]);

  const connect = useCallback(async (wallet: WalletInfo) => {
    setProblem(null);
    try {
      const { account, chainId: walletChain } = await connectWallet(wallet.provider);
      setConnection({ wallet, account, chainId: walletChain });
    } catch (error) {
      const explained = walletError(error);
      setProblem(
        explained.kind === "wallet-rejected"
          ? "You did not connect the wallet."
          : `The wallet gave an error: ${explained.kind === "wallet-error" ? explained.message : ""}`
      );
    }
  }, []);

  // The page forgets the wallet. Wallets keep their own permission until the user removes it there.
  const disconnect = useCallback(() => {
    setConnection(null);
    setProblem(null);
  }, []);

  const switchChain = useCallback(async () => {
    if (!connection) return;
    setProblem(null);
    // A wallet that does not know the chain gets only endpoints that passed the server's check (the wallet
    // keeps these URLs for the user). If none passed, the user adds the chain in the wallet.
    const add: AddChainParams | undefined =
      chain?.known && chain.name && chain.nativeCurrency && chain.walletRpcs.length > 0
        ? {
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.walletRpcs,
            blockExplorerUrls: chain.explorers.length > 0 ? chain.explorers.slice(0, 1) : undefined,
          }
        : undefined;
    const name = plainChainName(chain?.name ?? `chain ${chainId}`);
    try {
      const walletChain = await switchWalletChain(connection.wallet.provider, Number(chainId), add);
      // Without a chainChanged event the page would still show "Switch to …"
      setConnection((current) => (current ? { ...current, chainId: walletChain } : null));
    } catch (error) {
      const explained = walletError(error);
      setProblem(
        explained.kind === "wallet-rejected"
          ? "You did not switch the network in the wallet."
          : !add && isUnknownChain(error)
            ? `Your wallet does not know ${name}. Add it in your wallet, then try again.`
            : `The wallet could not switch the network: ${explained.kind === "wallet-error" ? explained.message : ""}`
      );
    }
  }, [connection, chain, chainId]);

  const noteWalletChain = useCallback(
    (walletChain: number) => setConnection((current) => (current ? { ...current, chainId: walletChain } : null)),
    []
  );

  const value = useMemo(
    () => ({
      wallets,
      connection,
      ready: !!connection && connection.chainId === Number(chainId),
      connect,
      disconnect,
      switchChain,
      noteWalletChain,
      problem,
    }),
    [wallets, connection, chainId, connect, disconnect, switchChain, noteWalletChain, problem]
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/* ---------------------------------------------------------------- controls */

/** The two lines at the top of the Read/Write tab (decision D8): the contract is not vetted, and the user signs. */
export function SafetyLine() {
  return (
    <div className="space-y-1 text-sm">
      <p className="flex items-start gap-1.5 text-gray-500">
        <IoWarningOutline className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Verified source code does not mean that a contract is safe or audited.
      </p>
      <p className="flex items-start gap-1.5 text-gray-500">
        <IoShieldCheckmarkOutline className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          You sign each transaction in your own wallet, and a sent transaction cannot be undone. Sourcify never holds
          your keys or funds.{" "}
          <Link href={TERMS_PATH} target="_blank" className="whitespace-nowrap underline hover:text-gray-700">
            Terms of use
          </Link>
        </span>
      </p>
    </div>
  );
}

/** The icon that the wallet gave (a data: URI), or its first letter. */
function WalletIcon({ wallet }: { wallet: WalletInfo }) {
  if (wallet.icon)
    // eslint-disable-next-line @next/next/no-img-element -- a data: URI from the wallet, not an asset of this site
    return <img src={wallet.icon} alt="" className="h-5 w-5 shrink-0 rounded" />;
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-500 text-[11px] font-bold text-white"
      aria-hidden="true"
    >
      {wallet.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * The connect button. A click shows the browser wallets that the page found
 * (EIP-6963: each installed wallet extension announces its name and icon).
 * There is no QR code and no WalletConnect: browser wallets only.
 */
export function ConnectWallet({
  primary = false,
  label = "Connect wallet",
  align = "left",
}: {
  primary?: boolean;
  label?: string;
  align?: "left" | "right";
}) {
  const { wallets, connect } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        className={primary ? buttonPrimary : buttonSecondary}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <IoWalletOutline className="h-4 w-4" />
        {label}
      </button>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
        >
          {wallets.length === 0 ? (
            <p className="px-1 py-1 text-sm text-gray-700">
              No browser wallet found. Install a wallet extension in this browser, then load the page again. You can
              still fill the form and copy the calldata.
            </p>
          ) : (
            <>
              <p className="px-1 pb-1 text-xs text-gray-500">Wallets found in this browser</p>
              <ul className="space-y-1">
                {wallets.map((wallet) => (
                  <li key={wallet.uuid}>
                    <button
                      type="button"
                      onClick={async () => {
                        setOpen(false);
                        await connect(wallet);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-cerulean-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
                    >
                      <WalletIcon wallet={wallet} />
                      {wallet.name}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-1 pt-1.5 text-xs leading-4 text-gray-500">
                By connecting a wallet, you agree to the{" "}
                <Link href={TERMS_PATH} target="_blank" className="underline">
                  Terms of use
                </Link>{" "}
                for Read / Write Contract.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The wallet state as one toolbar control: connect, connected address, or wrong network. */
export function WalletChip({ chainName }: { chainName: string }) {
  const { connection, ready, switchChain, disconnect } = useWallet();
  if (!connection) return <ConnectWallet align="right" />;
  if (!ready)
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <button
          type="button"
          className={`${buttonSecondary} border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100`}
          onClick={switchChain}
          data-tooltip-id="global-tooltip"
          data-tooltip-content={`Your wallet ${shortHex(connection.account)} is on chain ${connection.chainId}. This contract is on ${chainName}.`}
        >
          <IoWarning className="h-4 w-4 text-yellow-600" />
          Switch to {plainChainName(chainName)}
        </button>
        <DisconnectButton onClick={disconnect} />
      </span>
    );
  return (
    <span className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md border border-gray-300 bg-white pl-2 pr-1 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden="true" />
      <span className="sr-only">Wallet connected:</span>
      <span className="hidden sm:inline-flex">
        <WalletIcon wallet={connection.wallet} />
      </span>
      <span
        className="font-mono text-[13px] text-gray-900"
        data-tooltip-id="global-tooltip"
        data-tooltip-content={`${connection.wallet.name} · ${connection.account}`}
      >
        {shortHex(connection.account)}
      </span>
      <DisconnectButton onClick={disconnect} />
    </span>
  );
}

/** Forgets the connected wallet in this page. Shown with the address, and next to "Switch to …". */
function DisconnectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Disconnect the wallet"
      data-tooltip-id="global-tooltip"
      data-tooltip-content="Disconnect"
      className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
      onClick={onClick}
    >
      <IoLogOutOutline className="h-4 w-4" />
    </button>
  );
}
