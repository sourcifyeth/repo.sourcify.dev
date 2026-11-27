/**
 * The decimals and the symbol of a token, for `tokenAmount` fields: "1.5" can become a raw amount only when
 * the page knows the token's decimals. Read through the page's two-endpoint read (see rpcRead.ts), so that
 * one wrong provider cannot shift an amount by a factor of ten.
 */
import { decodeAbiParameters, hexToString } from "viem";
import { type RpcOptions, readFromSources } from "../rpcRead";

export interface TokenInfo {
  decimals: number;
  /** "" if the token has no readable symbol */
  symbol: string;
}

const DECIMALS = "0x313ce567"; // decimals()
const SYMBOL = "0x95d89b41"; // symbol()

async function callOnce(urls: string[], to: string, data: string, options: RpcOptions): Promise<string> {
  const result = await readFromSources(urls, { to, data }, options);
  if (result.check === "all-failed") throw new Error("No endpoint answered");
  if (result.check === "mismatch") throw new Error("The two endpoints gave different answers");
  if (result.answer.kind !== "return") throw new Error("The call reverted");
  return result.answer.data;
}

function decodeSymbol(data: string): string {
  try {
    return decodeAbiParameters([{ type: "string" }], data as `0x${string}`)[0];
  } catch {
    // Old tokens (MKR) return bytes32
    if (/^0x[0-9a-fA-F]{64}$/.test(data)) return hexToString(data as `0x${string}`).replace(/\0+$/, "");
    return "";
  }
}

const cache = new Map<string, Promise<TokenInfo>>();

/** Reads `decimals()` and `symbol()` of the token. One read per token and page; a failed read can be tried again. */
export function readTokenInfo(
  chainId: string | number,
  address: string,
  urls: string[],
  options: RpcOptions = {}
): Promise<TokenInfo> {
  const key = `${chainId}:${address.toLowerCase()}`;
  let load = cache.get(key);
  if (!load) {
    load = (async () => {
      const [decimalsData, symbolData] = await Promise.all([
        callOnce(urls, address, DECIMALS, options),
        // The symbol is only a label: without it the field still works
        callOnce(urls, address, SYMBOL, options).catch(() => "0x"),
      ]);
      if (!/^0x[0-9a-fA-F]{64}$/.test(decimalsData)) throw new Error("decimals() gave no number");
      const decimals = BigInt(decimalsData);
      if (decimals > BigInt(77)) throw new Error("decimals() is out of range");
      // A symbol comes from the token contract: keep it short and on one line
      const symbol = decodeSymbol(symbolData).replace(/\s+/g, " ").trim().slice(0, 24);
      return { decimals: Number(decimals), symbol };
    })();
    cache.set(key, load);
    load.catch(() => cache.delete(key));
  }
  return load;
}

/** For tests */
export function clearTokenCache() {
  cache.clear();
}
