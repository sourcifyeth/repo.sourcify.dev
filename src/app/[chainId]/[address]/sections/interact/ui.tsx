"use client";

import { useState } from "react";
import { IoCheckmark, IoCopyOutline, IoSearch } from "react-icons/io5";
import type { Fn, Mutability } from "@/utils/interact/abi";
import { copyText } from "@/utils/clipboard";

/*
 * The type and spacing scale of the section. Every part uses these, so sizes stay in proportion:
 * - text: 14px (text-sm) for every sentence, label, note and button; 12px (text-xs) only for chips, badges,
 *   counts and type tags; 15px for row names; 16px for the title of an open function
 * - code: IBM Plex Mono looks larger than the sans font, so code is 13px next to 14px text
 * - controls: inputs, selects and buttons are 32px high (h-8); small buttons are 28px (h-7)
 * - space: small gaps inside a group (a field: label, input, note), larger gaps between groups
 */
export const mono = "font-mono text-[13px]";
export const inputBase =
  "w-full min-w-0 rounded-md border bg-white px-2.5 font-mono text-[13px] text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-cerulean-blue-400 focus:outline-none focus:ring-2 focus:ring-cerulean-blue-200";
export const inputClass = `h-8 ${inputBase}`;
export const textareaClass = `py-1.5 leading-5 ${inputBase}`;
export const inputBorder = (hasError: boolean) => (hasError ? "border-red-400" : "border-gray-300");
export const selectClass =
  "h-8 shrink-0 cursor-pointer rounded-md border border-gray-300 bg-white pl-2 pr-1 text-xs text-gray-700 focus:border-cerulean-blue-400 focus:outline-none focus:ring-2 focus:ring-cerulean-blue-200";

const buttonBase =
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed";
export const buttonPrimary = `${buttonBase} h-8 px-3.5 text-sm bg-cerulean-blue-500 text-white hover:bg-cerulean-blue-600 disabled:bg-gray-200 disabled:text-gray-500`;
export const buttonOutline = `${buttonBase} h-8 px-3.5 text-sm border border-cerulean-blue-500 bg-white text-cerulean-blue-600 hover:bg-cerulean-blue-100 disabled:border-gray-300 disabled:bg-white disabled:text-gray-400`;
export const buttonSecondary = `${buttonBase} h-8 px-3 text-sm border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400`;
export const buttonSmall = `${buttonBase} h-7 px-2.5 text-xs border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400`;
export const buttonGhost = `${buttonBase} h-8 px-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
export const buttonQuiet =
  "inline-flex cursor-pointer items-center gap-1 rounded px-1 text-sm text-cerulean-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
export const linkClass = "text-cerulean-blue-600 hover:underline";

/** Read or write, as Blockscout marks each row. */
export function KindBadge({ fn }: { fn: Fn }) {
  const read = fn.mutability === "view" || fn.mutability === "pure";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 text-xs leading-5 ${read ? "bg-purple-50 text-purple-700" : "bg-cerulean-blue-100 text-cerulean-blue-700"}`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={MUTABILITY_HELP[fn.mutability]}
    >
      {read ? "read" : fn.mutability === "payable" ? "write · payable" : "write"}
    </span>
  );
}

/** The selector in a small grey chip with a copy button. */
export function SelectorChip({ fn, focusable = true }: { fn: Fn; focusable?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!fn.selector) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-gray-100 pl-1.5 pr-0.5 font-mono text-xs leading-5 text-gray-600">
      {fn.selector}
      <span
        role="button"
        // Inside a row button the chip is not a second tab stop; the selector is also in the open row
        tabIndex={focusable ? 0 : -1}
        aria-label={`Copy the selector ${fn.selector}`}
        onClick={(e) => {
          e.stopPropagation();
          copyText(fn.selector).then((ok) => {
            if (!ok) return;
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
          });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            copyText(fn.selector);
          }
        }}
        className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
      >
        {copied ? <IoCheckmark className="h-3 w-3" /> : <IoCopyOutline className="h-3 w-3" />}
      </span>
    </span>
  );
}

const MUTABILITY_HELP: Record<Mutability, string> = {
  view: "view: reads the state of the contract. No wallet and no gas.",
  pure: "pure: computes a result from the inputs only. No wallet and no gas.",
  nonpayable: "nonpayable: changes state. You send a transaction from your wallet.",
  payable: "payable: changes state and can take ether with the transaction.",
};

/** `(address,uint256)`: the part that tells two functions with the same name apart. */
export const argumentList = (fn: Fn) => fn.signature.slice(fn.name.length);

export function Selector({ fn, className = "" }: { fn: Fn; className?: string }) {
  if (!fn.selector) return null;
  return (
    <span
      className={`shrink-0 cursor-help font-mono text-xs text-gray-500 ${className}`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={`Selector of ${fn.signature}: the first 4 bytes of the calldata`}
    >
      {fn.selector}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

/** A two-or-more-way switch, in the look of the current item of the section bar. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: Array<{ value: T; label: React.ReactNode; disabled?: boolean; tooltip?: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "sm";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap rounded-md border border-gray-200 bg-gray-100 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          data-tooltip-id={option.tooltip ? "global-tooltip" : undefined}
          data-tooltip-content={option.tooltip}
          className={`cursor-pointer rounded ${size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-3 text-sm"} focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 ${
            value === option.value
              ? "bg-white font-medium text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex min-w-0 ${className}`}>
      <IoSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full min-w-0 rounded-md border border-gray-300 bg-white pl-8 pr-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cerulean-blue-400 focus:outline-none focus:ring-2 focus:ring-cerulean-blue-200"
      />
    </span>
  );
}

/** True if the function matches the search text: by name, signature or selector. */
export function matchesSearch(fn: Fn, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return fn.signature.toLowerCase().includes(text) || fn.selector.toLowerCase().startsWith(text);
}
