"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChainData } from "@/types/chain";
import { VerifiedContractMinimal } from "@/types/contract";
import { isAddress } from "@ethersproject/address";
import TopContracts from "./TopContracts";
import ExampleContracts from "./ExampleContracts";
import ChainMatchList from "./ChainMatchList";
import { fetchVerifiedAllChains, orderByChains } from "@/utils/allChains";

interface HomeFormProps {
  chains: ChainData[];
  serverUrl: string;
}

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; results: VerifiedContractMinimal[] };

export default function HomeForm({ chains, serverUrl }: HomeFormProps) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [retryCount, setRetryCount] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  // Whether the results dropdown is open
  const [isOpen, setIsOpen] = useState(false);
  // True while the router loads the contract page after a submit
  const [isNavigating, startNavigation] = useTransition();

  const isAddressValid = !!address && isAddress(address);

  // Look up the address on all chains as soon as it is valid.
  // A newer address cancels the previous request, so stale results never show.
  useEffect(() => {
    if (!isAddressValid) {
      setLookup({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setLookup({ status: "loading" });
    setIsOpen(true);
    fetchVerifiedAllChains(serverUrl, address, { signal: controller.signal })
      .then((results) => setLookup({ status: "done", results }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Error looking up address on all chains:", err);
        setLookup({ status: "error" });
      });
    return () => controller.abort();
  }, [address, isAddressValid, serverUrl, retryCount]);

  // Close the dropdown on a click outside the input and the dropdown
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const matches = useMemo(
    () => (lookup.status === "done" ? orderByChains(lookup.results, chains) : []),
    [lookup, chains]
  );
  const singleMatch = matches.length === 1 ? matches[0] : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setError("Please enter a contract address");
      return;
    }
    if (!isAddress(address)) {
      setError("Please enter a valid Ethereum address");
      return;
    }
    if (singleMatch) {
      const { chainId, address: matchAddress } = singleMatch.contract;
      startNavigation(() => router.push(`/${chainId}/${matchAddress}`));
    } else if (matches.length > 1) {
      // Several chains: the user must pick one from the dropdown
      setIsOpen(true);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();

    if (value && !isAddress(value)) {
      setAddress(value);
      setError("Please enter a valid Ethereum address");
    } else {
      // Add '0x' prefix if not present. Ethers.js accepts with and without it.
      setAddress(value && !value.startsWith("0x") ? "0x" + value : value);
      setError(null);
    }
  };

  // Arrow down from the input jumps into the list of chains
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && listRef.current) {
      e.preventDefault();
      setIsOpen(true);
      listRef.current.querySelector("a")?.focus();
    }
  };

  // Escape anywhere in the input or the dropdown closes the dropdown
  const handleComboKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      comboRef.current?.querySelector<HTMLInputElement>("#address")?.focus();
    }
  };

  let buttonLabel = "View Contract";
  if (isNavigating) buttonLabel = "Loading contract…";
  else if (singleMatch) buttonLabel = `View on ${singleMatch.chain?.name ?? `Chain ${singleMatch.contract.chainId}`}`;
  else if (matches.length > 1) buttonLabel = `Select one of ${matches.length} chains`;
  const isButtonEnabled = matches.length > 0 && !isNavigating;
  const showDropdown = isOpen && lookup.status !== "idle";

  return (
    <>
      <form className="mt-4 md:mt-8 space-y-4 w-full max-w-xl mx-auto mb-10" onSubmit={handleSubmit}>
        <div ref={comboRef} className="relative" onKeyDown={handleComboKeyDown}>
          <label htmlFor="address" className="block text-lg font-medium text-gray-700 mb-1">
            Contract Address
          </label>
          <input
            type="text"
            name="address"
            id="address"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className={`block w-full pl-3 pr-10 py-3 text-base font-mono bg-cerulean-blue-100 border-2 ${
              error ? "border-red-500" : "border-cerulean-blue-300 hover:border-cerulean-blue-400"
            } rounded-md text-cerulean-blue-600`}
            placeholder="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
            value={address}
            onChange={handleAddressChange}
            onKeyDown={handleAddressKeyDown}
            onFocus={() => setIsOpen(true)}
          />
          {error && <p className="mt-1 text-sm text-left text-red-600">{error}</p>}

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 sm:p-3 shadow-xl text-left">
              {lookup.status === "loading" && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cerulean-blue-300 border-t-cerulean-blue-600" />
                  Looking up chains…
                </div>
              )}

              {lookup.status === "error" && (
                <p className="text-sm text-red-600">
                  Could not look up chains.{" "}
                  <button type="button" onClick={() => setRetryCount((n) => n + 1)} className="underline cursor-pointer">
                    Try again
                  </button>
                </p>
              )}

              {lookup.status === "done" && <ChainMatchList key={address} matches={matches} listRef={listRef} />}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!isButtonEnabled}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-md font-medium text-white ${
            isButtonEnabled || isNavigating
              ? "bg-cerulean-blue hover:bg-cerulean-blue-600 cursor-pointer"
              : "bg-gray-400 cursor-not-allowed"
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cerulean-blue-500`}
        >
          {isNavigating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {buttonLabel}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow-sm h-full">
          <ExampleContracts chains={chains} />
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm h-full">
          <TopContracts />
        </div>
      </div>
    </>
  );
}
