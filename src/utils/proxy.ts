import type { ProxyResolutionData, ProxyType } from "@/types/contract";

/**
 * Whether the implementation address comes from values that the contract controls (a storage slot,
 * or a function such as `implementation()`), so it is not proof of where the contract sends its calls.
 * The exception is an EIP-1167 clone: Sourcify reports this type only if the runtime bytecode starts
 * with the exact 45-byte stub, and the stub has the address inside it next to the DELEGATECALL.
 * Every other type, also a type that this frontend does not know yet, counts as a heuristic.
 */
export function isHeuristicProxyResolution(proxyType: ProxyType | null | undefined): boolean {
  return proxyType !== "EIP1167Proxy";
}

/** The tooltip text of the "Proxy" badge in the page header. */
export function proxyBadgeTooltip(proxyResolution: ProxyResolutionData): string {
  const implementations = proxyResolution.implementations ?? [];
  const names = implementations.map((implementation) => implementation.name || implementation.address);
  const target = names.length ? ` for ${names.join(", ")}` : "";
  if (!isHeuristicProxyResolution(proxyResolution.proxyType)) {
    return `This contract is a proxy${target}.`;
  }
  const reported =
    implementations.length > 1
      ? "The implementations are reported by the contract and not confirmed."
      : "The implementation is reported by the contract and not confirmed.";
  return `Detected as a proxy${target}. ${reported}`;
}
