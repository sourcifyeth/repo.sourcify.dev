"use client";

import type { Fn } from "@/utils/interact/abi";
import { useDocsShown } from "./NatSpecDisplay";
import { Selector, argumentList } from "./ui";

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
    : fn.outputs.map((output) => `${output.type}${output.name ? ` ${output.name}` : ""}`).join(", ");

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

/**
 * Shown when a row opens: the description and what the function returns. The full signature is not shown:
 * the form lists the inputs, and the row of an overloaded function shows its argument types.
 */
export function FunctionDetails({ fn, showSelector = true }: { fn: Fn; showSelector?: boolean }) {
  const read = fn.mutability === "view" || fn.mutability === "pure";
  const returns = read && fn.outputs.length > 0;
  const notes = useDocsShown() && (!!fn.notice || !!fn.dev);
  if (!showSelector && !returns && !notes) return <div className="pt-2" />;
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
  // Hidden until the user clicks "Show Docs" in the function
  if (!useDocsShown()) return null;
  return (
    // All NatSpec notes are small (12px), so that they do not compete with the form and the results
    <p className={`text-xs leading-[18px] ${kind === "user" ? "text-gray-700" : "text-gray-500"} ${className}`}>
      <span
        className="mr-1.5 inline-block cursor-help whitespace-nowrap rounded bg-gray-200/70 px-1.5 align-[1px] text-[11px] leading-4 text-gray-600"
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
