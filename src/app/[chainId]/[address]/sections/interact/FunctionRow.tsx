"use client";

import type { Fn } from "@/utils/interact/abi";
import { MutabilityBadge, Selector, argumentList } from "./ui";

/** NatSpec text with `code` in backticks shown as code. */
export function DocText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
          <code key={i} className="rounded bg-gray-200/70 px-1 font-mono text-[0.92em] text-gray-800">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** `(uint256 balance)`: the return types, with their names if the ABI has them. */
export const returnList = (fn: Fn) =>
  fn.outputs.length === 0
    ? "nothing"
    : fn.outputs
        .map((output) => `${output.type === "tuple" ? "tuple" : output.type}${output.name ? ` ${output.name}` : ""}`)
        .join(", ");

/**
 * The text of a closed row: the function name only. Overloaded functions also show
 * their argument types, because only the types tell them apart.
 */
export function FunctionName({
  fn,
  mono = false,
  size,
  bold = false,
}: {
  fn: Fn;
  mono?: boolean;
  size?: string;
  /** Bold for the open function */
  bold?: boolean;
}) {
  return (
    <span
      className={`min-w-0 truncate ${mono ? "font-mono" : ""} ${size ?? (mono ? "text-[13px]" : "text-[15px]")}`}
      title={fn.overloaded ? fn.signature : undefined}
    >
      <span className={`text-gray-900 ${bold ? "font-semibold" : ""}`}>{fn.name}</span>
      {fn.overloaded && <span className="font-mono text-xs text-gray-500">{argumentList(fn)}</span>}
    </span>
  );
}

/** Kept for older callers: the name and the mutability badge. */
export function FunctionTitle({ fn }: { fn: Fn }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
      <FunctionName fn={fn} mono />
      <MutabilityBadge mutability={fn.mutability} />
    </span>
  );
}

/**
 * Shown when a row opens: the description and what the function returns. The full signature is not shown:
 * the form lists the inputs, and the row of an overloaded function shows its argument types.
 */
export function FunctionDetails({ fn, showSelector = true }: { fn: Fn; showSelector?: boolean }) {
  const read = fn.mutability === "view" || fn.mutability === "pure";
  const returns = read && fn.outputs.length > 0;
  if (!showSelector && !returns && !fn.notice && !fn.dev) return <div className="pt-2" />;
  return (
    <div className="mb-5 space-y-1.5 pt-1">
      {(showSelector || returns) && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm leading-5 text-gray-500">
          {showSelector && <Selector fn={fn} />}
          {returns && (
            <span>
              returns <code className="break-all font-mono text-[13px] text-gray-600">{returnList(fn)}</code>
            </span>
          )}
        </p>
      )}
      {fn.notice && <NatSpecNote kind="user" text={fn.notice} />}
      {fn.dev && <NatSpecNote kind="dev" text={fn.dev} />}
    </div>
  );
}

const NOTE_KINDS = {
  user: { label: "NatSpec Note @notice", tag: "@notice", help: "a description for the users of the contract" },
  dev: { label: "NatSpec Note @dev", tag: "@dev", help: "a note for developers" },
  param: { label: "NatSpec Note @param", tag: "@param", help: "the description of this input" },
  return: { label: "NatSpec Note @return", tag: "@return", help: "the description of this returned value" },
} as const;

/**
 * A NatSpec text with a small label that says which tag it comes from, so that the reader
 * can tell the user notice, the developer note and the descriptions of inputs and outputs apart.
 */
export function NatSpecNote({
  kind,
  text,
  className = "",
}: {
  kind: keyof typeof NOTE_KINDS;
  text: string;
  className?: string;
}) {
  const note = NOTE_KINDS[kind];
  return (
    // All NatSpec notes are small (12px), so that they do not compete with the form and the results
    <p className={`text-xs leading-[18px] ${kind === "user" ? "text-gray-700" : "text-gray-500"} ${className}`}>
      <span
        className={`mr-1.5 inline-block cursor-help whitespace-nowrap rounded bg-gray-200/70 px-1.5 align-[1px] text-gray-600 text-[11px] leading-4`}
        data-tooltip-id="global-tooltip"
        data-tooltip-content={`From the ${note.tag} tag in the source code: ${note.help}`}
      >
        {note.label}
      </span>
      <DocText text={text} />
    </p>
  );
}

export function EmptyFunctions({ kind, query }: { kind: "read" | "write" | "any"; query?: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-gray-500">
      {query
        ? `No function matches “${query}”. You can search by name, argument type or selector (0x…).`
        : kind === "any"
          ? "The ABI of this contract has no functions, so there is nothing to call."
          : kind === "read"
            ? "This contract has no read functions (view or pure)."
            : "This contract has no write functions."}
    </div>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** The function that `?fn=` in the URL names: by name, signature or selector. For screenshots and deep links. */
export function functionFromUrl(functions: Fn[]): Fn | undefined {
  if (typeof window === "undefined") return undefined;
  const wanted = new URLSearchParams(window.location.search).get("fn");
  if (!wanted) return undefined;
  return functions.find((fn) => fn.signature === wanted || fn.selector === wanted || fn.name === wanted);
}
