/**
 * Decoding with viem: return values into form values (for the result tree), and revert data into
 * an error that the page can explain.
 */
import { type Abi, decodeErrorResult, decodeFunctionResult } from "viem";
import { type AbiParam, type Fn, type FormValue, arrayOf, elementParam } from "./abi";
import type { CallError } from "./types";

/** A decoded value from viem, as a form value: integers become decimal text, tuples become lists in component order. */
export function toFormValue(param: AbiParam, value: unknown): FormValue {
  const array = arrayOf(param.type);
  if (array) {
    const element = elementParam(param);
    return (Array.isArray(value) ? value : []).map((item) => toFormValue(element, item));
  }
  if (param.type === "tuple") {
    const components = param.components ?? [];
    // viem gives an object for a struct whose fields all have names, else a list
    const record = value as Record<string, unknown> | unknown[];
    return components.map((component, i) =>
      toFormValue(component, Array.isArray(record) ? record[i] : record?.[component.name])
    );
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint" || typeof value === "number") return value.toString();
  return value == null ? "" : String(value);
}

/** The return data of a call, decoded per output. Throws if the data does not fit the outputs. */
export function decodeOutputs(fn: Fn, data: string): FormValue[] {
  if (fn.outputs.length === 0) return [];
  const abi = [
    { type: "function", name: fn.name, inputs: fn.inputs, outputs: fn.outputs, stateMutability: fn.mutability },
  ] as Abi;
  const decoded = decodeFunctionResult({ abi, functionName: fn.name, data: data as `0x${string}` }) as unknown;
  // viem returns the value itself for one output, and a list for more
  const values = fn.outputs.length === 1 ? [decoded] : (decoded as unknown[]);
  return fn.outputs.map((output, i) => toFormValue(output, values[i]));
}

/** What a Solidity panic code means (from the Solidity documentation, "Panic via assert and Error via require"). */
const PANIC_MEANINGS: Record<number, string> = {
  0x00: "a generic compiler panic",
  0x01: "an assert() failed",
  0x11: "an arithmetic overflow or underflow",
  0x12: "a division or modulo by zero",
  0x21: "a conversion to an enum with a value out of range",
  0x22: "access to a storage byte array that is encoded wrongly",
  0x31: "pop() on an empty array",
  0x32: "an array index out of bounds",
  0x41: "too much memory, or an array that is too large",
  0x51: "a call to a zero-initialized function variable",
};

/** A decoded argument as short text for the error box: integers in decimal, structs and lists as JSON. */
function argText(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value;
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

/**
 * Explains revert data. `Error(string)` and `Panic(uint256)` are known to every contract; custom errors
 * come from the contract's ABIs. Unknown data stays raw.
 */
export function decodeRevert(data: string, errorAbi: ReadonlyArray<Record<string, unknown>>): CallError {
  const raw = (data || "0x").toLowerCase();
  if (raw === "0x") return { kind: "unknown-revert", raw };
  try {
    // viem adds Error(string) and Panic(uint256) to the given ABI by itself
    const decoded = decodeErrorResult({ abi: errorAbi as Abi, data: raw as `0x${string}` });
    if (decoded.errorName === "Error") return { kind: "revert-string", reason: String(decoded.args?.[0] ?? ""), raw };
    if (decoded.errorName === "Panic") {
      const code = Number(decoded.args?.[0] ?? 0);
      return {
        kind: "panic",
        code: `0x${code.toString(16).padStart(2, "0")}`,
        meaning: PANIC_MEANINGS[code] ?? "an unknown panic code",
        raw,
      };
    }
    const inputs = (decoded.abiItem as { inputs?: AbiParam[] }).inputs ?? [];
    return {
      kind: "custom-error",
      name: decoded.errorName,
      selector: raw.slice(0, 10),
      args: inputs.map((input, i) => ({
        name: input.name || `arg ${i}`,
        type: input.type === "tuple" ? "tuple" : input.type,
        value: argText((decoded.args as unknown[] | undefined)?.[i]),
      })),
      raw,
    };
  } catch {
    return { kind: "unknown-revert", raw };
  }
}
