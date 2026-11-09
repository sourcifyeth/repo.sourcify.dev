import { describe, expect, it } from "vitest";
import type { ProxyImplementation, ProxyResolutionData, ProxyType } from "@/types/contract";
import { isHeuristicProxyResolution, proxyBadgeTooltip } from "./proxy";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

function resolution(proxyType: ProxyType | null, implementations: Partial<ProxyImplementation>[]): ProxyResolutionData {
  return {
    isProxy: true,
    proxyType,
    implementations: implementations.map((implementation) => ({ address: A, name: "", ...implementation })),
  };
}

describe("isHeuristicProxyResolution", () => {
  it("is not a heuristic for an EIP-1167 clone", () => {
    expect(isHeuristicProxyResolution("EIP1167Proxy")).toBe(false);
  });

  it.each<ProxyType>(["EIP1967Proxy", "DiamondProxy", "GnosisSafeProxy", "FixedProxy"])(
    "is a heuristic for %s",
    (proxyType) => {
      expect(isHeuristicProxyResolution(proxyType)).toBe(true);
    }
  );

  it("is a heuristic for a type that the frontend does not know", () => {
    // The safe default: a new server type must still get the notice.
    expect(isHeuristicProxyResolution("SomeFutureProxy" as ProxyType)).toBe(true);
  });

  it("is a heuristic when the type is missing", () => {
    expect(isHeuristicProxyResolution(null)).toBe(true);
    expect(isHeuristicProxyResolution(undefined)).toBe(true);
  });
});

describe("proxyBadgeTooltip", () => {
  it("has no target when there are no implementations", () => {
    expect(proxyBadgeTooltip(resolution("EIP1967Proxy", []))).toBe(
      "Detected as a proxy. The implementation is reported by the contract and not confirmed."
    );
  });

  it("uses the name of the implementation if there is one", () => {
    expect(proxyBadgeTooltip(resolution("EIP1967Proxy", [{ name: "Token" }]))).toBe(
      "Detected as a proxy for Token. The implementation is reported by the contract and not confirmed."
    );
  });

  it("uses the address of the implementation if there is no name", () => {
    expect(proxyBadgeTooltip(resolution("EIP1967Proxy", [{ address: A }]))).toBe(
      `Detected as a proxy for ${A}. The implementation is reported by the contract and not confirmed.`
    );
  });

  it("lists all implementations of a diamond", () => {
    expect(proxyBadgeTooltip(resolution("DiamondProxy", [{ name: "FacetA" }, { address: B }]))).toBe(
      `Detected as a proxy for FacetA, ${B}. The implementations are reported by the contract and not confirmed.`
    );
  });

  it("states it as a fact for an EIP-1167 clone", () => {
    expect(proxyBadgeTooltip(resolution("EIP1167Proxy", [{ address: A }]))).toBe(`This contract is a proxy for ${A}.`);
  });
});
