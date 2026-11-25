import { UserRejectedRequestError, type EIP1193Provider } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_FALLBACK_MS,
  WrongChainError,
  connectWallet,
  discoverWallets,
  sendTransaction,
  switchWalletChain,
  walletError,
  walletErrorCode,
} from "./wallet";

/** A fake EIP-1193 wallet: answers by method, records the requests. */
function fakeProvider(answers: Record<string, (params: unknown) => unknown>) {
  const requests: Array<{ method: string; params?: unknown }> = [];
  const provider = {
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      requests.push({ method, params });
      const answer = answers[method];
      if (!answer) throw Object.assign(new Error(`no ${method}`), { code: 4200 });
      return answer(params);
    },
    on: () => undefined,
    removeListener: () => undefined,
  } as unknown as EIP1193Provider;
  return { provider, requests };
}

afterEach(() => vi.useRealTimers());

describe("discoverWallets", () => {
  it("lists the wallets that announce themselves, and drops icons that are not data URIs", () => {
    const target = new EventTarget();
    const { provider } = fakeProvider({});
    target.addEventListener("eip6963:requestProvider", () => {
      for (const [uuid, icon] of [
        ["a", "data:image/svg+xml;base64,PHN2Zy8+"],
        ["b", "https://tracker.example/icon.png"],
      ])
        target.dispatchEvent(
          Object.assign(new Event("eip6963:announceProvider"), {
            detail: { info: { uuid, name: `Wallet ${uuid}`, icon }, provider },
          })
        );
    });
    let seen: Array<{ name: string; icon?: string }> = [];
    const stop = discoverWallets((wallets) => (seen = wallets), target);
    expect(seen.map((wallet) => [wallet.name, wallet.icon])).toEqual([
      ["Wallet a", "data:image/svg+xml;base64,PHN2Zy8+"],
      ["Wallet b", undefined],
    ]);
    stop();
  });

  it("falls back to window.ethereum when no wallet announces itself", () => {
    vi.useFakeTimers();
    const { provider } = fakeProvider({});
    const target = Object.assign(new EventTarget(), { ethereum: provider });
    let seen: Array<{ uuid: string }> = [];
    discoverWallets((wallets) => (seen = wallets), target);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(DISCOVERY_FALLBACK_MS);
    expect(seen.map((wallet) => wallet.uuid)).toEqual(["injected"]);
  });
});

describe("connectWallet", () => {
  it("returns the first account and the chain", async () => {
    const { provider } = fakeProvider({ eth_requestAccounts: () => ["0xabc"], eth_chainId: () => "0x2105" });
    expect(await connectWallet(provider)).toEqual({ account: "0xabc", chainId: 8453 });
  });
});

describe("switchWalletChain", () => {
  const add = {
    chainName: "OP Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.optimism.io"],
  };

  it("switches, and adds the chain when the wallet does not know it", async () => {
    const known = fakeProvider({ wallet_switchEthereumChain: () => null });
    await switchWalletChain(known.provider, 10, add);
    expect(known.requests).toEqual([{ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa" }] }]);

    const unknown = fakeProvider({
      wallet_switchEthereumChain: () => {
        throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
      },
      wallet_addEthereumChain: () => null,
    });
    await switchWalletChain(unknown.provider, 10, add);
    expect(unknown.requests[1]).toEqual({ method: "wallet_addEthereumChain", params: [{ chainId: "0xa", ...add }] });
  });

  it("passes other errors on", async () => {
    const rejecting = fakeProvider({
      wallet_switchEthereumChain: () => {
        throw Object.assign(new Error("User rejected"), { code: 4001 });
      },
    });
    await expect(switchWalletChain(rejecting.provider, 10, add)).rejects.toMatchObject({ code: 4001 });
  });
});

describe("walletError", () => {
  it("tells a rejection from other wallet errors", () => {
    expect(walletError(Object.assign(new Error("denied"), { code: 4001 }))).toEqual({ kind: "wallet-rejected" });
    expect(walletError(new UserRejectedRequestError(new Error("denied")))).toEqual({ kind: "wallet-rejected" });
    expect(walletErrorCode(new UserRejectedRequestError(new Error("denied")))).toBe(4001);
    expect(walletError(new Error("insufficient funds for gas"))).toEqual({
      kind: "wallet-error",
      message: "insufficient funds for gas",
    });
  });
});

describe("revertDataOf", () => {
  it("finds revert data in a wallet error, at the top or one level down", async () => {
    const { revertDataOf } = await import("./wallet");
    expect(revertDataOf({ code: -32603, data: "0x08c379a0" + "00".repeat(32) })).toMatch(/^0x08c379a0/);
    expect(revertDataOf({ code: -32603, data: { data: "0x9e87fac8" } })).toBe("0x9e87fac8");
    expect(revertDataOf({ code: 4001, message: "denied" })).toBeUndefined();
    expect(revertDataOf({ data: "0x12" })).toBeUndefined();
  });
});

describe("revertDataOf in viem errors", () => {
  it("finds data one level down, as MetaMask sends it", async () => {
    const { revertDataOf } = await import("./wallet");
    const { BaseError } = await import("viem");
    const inner = Object.assign(new Error("Internal JSON-RPC error."), { code: -32603, data: { data: "0x9e87fac8" } });
    expect(revertDataOf(new BaseError("An internal error was received.", { cause: inner }))).toBe("0x9e87fac8");
  });
});

describe("wallets that answer differently (Rabby)", () => {
  it("shows the message of a plain-object error, and adds a chain that the wallet calls unrecognized", async () => {
    const { walletError, isUnknownChain } = await import("./wallet");
    expect(walletError({ code: -32603, message: "Unrecognized chain ID 0xaa36a7" })).toEqual({
      kind: "wallet-error",
      message: "Unrecognized chain ID 0xaa36a7",
    });
    expect(walletError({ code: 4100 })).toEqual({ kind: "wallet-error", message: '{"code":4100}' });
    expect(isUnknownChain({ code: -32603, message: "Unrecognized chain ID 0xaa36a7" })).toBe(true);
    expect(isUnknownChain({ code: 4001, message: "User rejected" })).toBe(false);

    const rabby = fakeProvider({
      wallet_switchEthereumChain: () => {
        throw { code: -32603, message: "Unrecognized chain ID" };
      },
      wallet_addEthereumChain: () => null,
    });
    await switchWalletChain(rabby.provider, 11155111, {
      chainName: "Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    });
    expect(rabby.requests.map((request) => request.method)).toEqual([
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
    ]);
  });
});

describe("sendTransaction", () => {
  const HASH = `0x${"ab".repeat(32)}`;
  const TX = {
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    data: "0xd0e30db0",
    value: BigInt(1),
  };
  const receipt = {
    transactionHash: HASH,
    blockHash: `0x${"cd".repeat(32)}`,
    blockNumber: "0x10",
    transactionIndex: "0x0",
    from: TX.from,
    to: TX.to,
    cumulativeGasUsed: "0x5208",
    gasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    status: "0x1",
    type: "0x2",
    contractAddress: null,
  };

  it("asks the wallet for its chain right before the send, and sends nothing on another chain", async () => {
    const { provider, requests } = fakeProvider({ eth_chainId: () => "0x89", eth_sendTransaction: () => HASH });
    const onHash = vi.fn();
    await expect(sendTransaction(provider, TX, 1, onHash)).rejects.toBeInstanceOf(WrongChainError);
    expect(requests.map((request) => request.method)).toEqual(["eth_chainId"]);
    expect(onHash).not.toHaveBeenCalled();
    expect(walletError(new WrongChainError(137))).toEqual({ kind: "wrong-chain", walletChain: 137 });
  });

  it("returns 'unconfirmed' with the hash when waiting for the receipt fails, and sends only once", async () => {
    const { provider, requests } = fakeProvider({
      eth_chainId: () => "0x1",
      eth_sendTransaction: () => HASH,
      eth_blockNumber: () => "0x10",
      eth_getTransactionReceipt: () => {
        throw Object.assign(new Error("Internal JSON-RPC error."), { code: -32603 });
      },
      eth_getTransactionByHash: () => {
        throw Object.assign(new Error("Internal JSON-RPC error."), { code: -32603 });
      },
    });
    const onHash = vi.fn();
    const result = await sendTransaction(provider, TX, 1, onHash, { receiptTimeoutMs: 300 });
    expect(result).toMatchObject({ status: "unconfirmed", hash: HASH });
    expect(onHash).toHaveBeenCalledWith(HASH);
    expect(requests.filter((request) => request.method === "eth_sendTransaction")).toHaveLength(1);
  });

  it("returns the mined transaction with its block and gas", async () => {
    const { provider } = fakeProvider({
      eth_chainId: () => "0x1",
      eth_sendTransaction: () => HASH,
      eth_blockNumber: () => "0x10",
      eth_getTransactionReceipt: () => receipt,
    });
    expect(await sendTransaction(provider, TX, 1, () => undefined)).toEqual({
      status: "mined",
      hash: HASH,
      block: 16,
      gasUsed: "21000",
      reverted: false,
    });
  });
});
