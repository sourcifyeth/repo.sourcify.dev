/**
 * The admin of a proxy, from its storage. Transparent proxies (OpenZeppelin, and the older ZeppelinOS
 * "AdminUpgradeabilityProxy" that USDC uses) answer their own functions, such as implementation() and
 * admin(), only when the admin calls them. For any other caller they forward the call to the
 * implementation, which usually reverts. A read can use any sender, so the page reads these functions
 * as the admin.
 */
import { type RpcOptions, jsonRpc } from "./rpcRead";

/** Storage slots that hold the admin address, in the order to try. */
export const ADMIN_SLOTS = [
  // EIP-1967: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  // ZeppelinOS AdminUpgradeabilityProxy: keccak256("org.zeppelinos.proxy.admin")
  "0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b",
] as const;

const found = new Map<string, Promise<string | null>>();

/**
 * The admin address of the proxy, or null if no known slot holds one. Asks the given endpoints in turn;
 * the answer is kept for the visit.
 */
export function proxyAdmin(
  chainId: string,
  proxy: string,
  urls: string[],
  options: RpcOptions = {}
): Promise<string | null> {
  const key = `${chainId}:${proxy.toLowerCase()}`;
  const cached = found.get(key);
  if (cached) return cached;
  const lookup = (async () => {
    for (const url of urls) {
      try {
        for (const slot of ADMIN_SLOTS) {
          const word = await jsonRpc<string>(url, "eth_getStorageAt", [proxy, slot, "latest"], options);
          const address = `0x${word.slice(-40)}`.toLowerCase();
          if (/^0x[0-9a-f]{40}$/.test(address) && !/^0x0{40}$/.test(address)) return address;
        }
        return null;
      } catch {
        // Try the next endpoint
      }
    }
    return null;
  })();
  found.set(key, lookup);
  // A failed lookup (all endpoints down) may be tried again later
  lookup.then((admin) => admin === null && found.delete(key));
  return lookup;
}

/** For tests */
export function clearProxyAdminCache() {
  found.clear();
}
