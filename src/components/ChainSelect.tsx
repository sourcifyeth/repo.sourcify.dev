"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";

interface Chain {
  chainId: number;
  name: string;
  title?: string;
  supported: boolean;
}

interface ChainSelectProps {
  value: string | undefined;
  handleChainIdChange: (value: string) => void;
  id?: string;
  availableChains?: number[];
  transparent?: boolean;
  className?: string;
  chains: Chain[];
}

export default function ChainSelect({ value, handleChainIdChange, className, chains }: ChainSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Create Fuse instance with the chains data
  const fuse = useMemo(() => {
    return new Fuse(chains, {
      keys: ["name", "title", "chainId"],
      threshold: 0.5, // Lower threshold means more strict matching
      includeScore: true,
      shouldSort: true,
    });
  }, [chains]);

  // Filter options using Fuse.js
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return chains;
    return fuse.search(searchTerm).map((result) => result.item);
  }, [searchTerm, fuse, chains]);

  const selectedChain = chains.find((chain) => chain.chainId.toString() === value);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <div
        className={`${className} flex items-center justify-between cursor-pointer`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selectedChain ? `${selectedChain.title || selectedChain.name} (${selectedChain.chainId})` : "Choose chain"}
        </span>
        <svg
          className="w-5 h-5 ml-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
          <div className="p-2">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-cerulean-blue-500"
              placeholder="Search chains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.map((chain) => (
              <div
                key={chain.chainId}
                className={`px-4 py-2 text-sm cursor-pointer hover:bg-cerulean-blue-100 ${
                  value === chain.chainId.toString() ? "bg-cerulean-blue-100" : ""
                }`}
                onClick={() => {
                  handleChainIdChange(chain.chainId.toString());
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {chain.title || chain.name} ({chain.chainId})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
