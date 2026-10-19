"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAddress } from "@ethersproject/address";
import { IoSearch, IoClose, IoClipboardOutline, IoTimeOutline } from "react-icons/io5";
import { ChainData } from "@/types/chain";
import { VerifiedContractMinimal } from "@/types/contract";
import ExampleContracts from "./ExampleContracts";
import ChainMatchList from "./ChainMatchList";
import { ChainMatch, fetchVerifiedAllChains, orderByChains } from "@/utils/allChains";
import { addRecentSearch, clearRecentSearches, getRecentSearches, RecentSearch } from "@/utils/recentSearches";
import { moveFocusInList } from "@/utils/listKeyboard";

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
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  // Whether the dropdown is open
  const [isOpen, setIsOpen] = useState(false);
  // True while the router loads the contract page after Enter
  const [isNavigating, startNavigation] = useTransition();
  const comboRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAddressValid = !!address && isAddress(address);

  // localStorage is only available in the browser, so read it after the first render
  useEffect(() => setRecentSearches(getRecentSearches()), []);

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

  // Close the dropdown on a click outside the search bar and the dropdown
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

  const chainName = (chainId: string) =>
    chains.find((chain) => chain.chainId.toString() === chainId)?.name ?? `Chain ${chainId}`;

  const rememberSearch = ({ contract }: ChainMatch) =>
    setRecentSearches(addRecentSearch({ address: contract.address, chainId: contract.chainId }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (!isAddress(address)) {
      setError("Please enter a valid Ethereum address");
      return;
    }
    if (singleMatch) {
      rememberSearch(singleMatch);
      const { chainId, address: matchAddress } = singleMatch.contract;
      startNavigation(() => router.push(`/${chainId}/${matchAddress}`));
    } else {
      setIsOpen(true);
    }
  };

  const updateAddress = (raw: string) => {
    const value = raw.trim();
    if (value && !isAddress(value)) {
      setAddress(value);
      setError("Please enter a valid Ethereum address");
    } else {
      // Add '0x' prefix if not present. Ethers.js accepts with and without it.
      setAddress(value && !value.startsWith("0x") ? "0x" + value : value);
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      updateAddress(await navigator.clipboard.readText());
      setIsOpen(true);
    } catch {
      // The browser blocked clipboard access. The user can still paste with the keyboard.
    }
    inputRef.current?.focus();
  };

  const handleClear = () => {
    updateAddress("");
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handlePickExample = (exampleAddress: string) => {
    updateAddress(exampleAddress);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // Arrow down from the input jumps into the dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && dropdownRef.current) {
      e.preventDefault();
      dropdownRef.current.querySelector("a")?.focus();
    }
  };

  // Escape anywhere in the search bar or the dropdown closes the dropdown
  const handleComboKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.focus();
    }
  };

  const showRecent = !address && recentSearches.length > 0;
  const showDropdown = isOpen && (lookup.status !== "idle" || showRecent);

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 md:mt-8 mb-10 space-y-4">
      <form onSubmit={handleSubmit}>
        <div ref={comboRef} className="relative" onKeyDown={handleComboKeyDown}>
          <label htmlFor="address" className="sr-only">
            Contract address
          </label>
          <div
            className={`flex items-center gap-2 rounded-lg bg-white border-2 shadow-sm px-3 ${
              error ? "border-red-500" : "border-cerulean-blue-300 focus-within:border-cerulean-blue-500"
            }`}
          >
            <IoSearch className="shrink-0 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              name="address"
              id="address"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              className="min-w-0 flex-1 py-3 text-base font-mono bg-transparent text-cerulean-blue-700 placeholder:font-sans placeholder:text-gray-400 focus:outline-none"
              placeholder="Search by contract address"
              value={address}
              onChange={(e) => updateAddress(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsOpen(true)}
              // autoFocus focuses the input before hydration, so onFocus does not fire for the first click
              onClick={() => setIsOpen(true)}
            />
            {isNavigating ? (
              <span
                aria-label="Loading contract"
                className="shrink-0 h-5 w-5 animate-spin rounded-full border-2 border-cerulean-blue-200 border-t-cerulean-blue-600"
              />
            ) : address ? (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear"
                className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <IoClose className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePaste}
                aria-label="Paste address"
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-sm text-cerulean-blue-600 hover:bg-cerulean-blue-100 cursor-pointer"
              >
                <IoClipboardOutline className="w-4 h-4" />
                <span className="hidden sm:inline">Paste</span>
              </button>
            )}
          </div>
          {error && <p className="mt-1 text-sm text-left text-red-600">{error}</p>}

          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 sm:p-3 shadow-xl text-left"
            >
              {showRecent && (
                <div>
                  <div className="flex items-center justify-between mb-2 text-sm text-gray-700">
                    <span>Recent searches</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches();
                        setRecentSearches([]);
                        inputRef.current?.focus();
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <ul
                    onKeyDown={moveFocusInList}
                    className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100"
                  >
                    {recentSearches.map((search) => (
                      <li key={`${search.chainId}-${search.address}`}>
                        <Link
                          href={`/${search.chainId}/${search.address}`}
                          onClick={() => setRecentSearches(addRecentSearch(search))}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-cerulean-blue-100 focus:bg-cerulean-blue-100 focus:outline-none"
                        >
                          <IoTimeOutline className="shrink-0 w-4 h-4 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-mono text-gray-900">{search.address}</div>
                            <div className="truncate text-xs text-gray-500">{chainName(search.chainId)}</div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

              {lookup.status === "done" && <ChainMatchList key={address} matches={matches} onSelect={rememberSearch} />}
            </div>
          )}
        </div>
      </form>

      <ExampleContracts onPick={handlePickExample} />
    </div>
  );
}
