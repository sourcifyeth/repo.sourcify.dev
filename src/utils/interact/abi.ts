/**
 * The function model of the "Read / Write Contract" section: ABI types, form values, input checks
 * and calldata. No network code here.
 */
import { type Abi, encodeFunctionData, isAddress, keccak256, toBytes } from "viem";

export interface AbiParam {
  name: string;
  type: string;
  internalType?: string;
  components?: AbiParam[];
}

export interface AbiEntry {
  type: string;
  name?: string;
  inputs?: AbiParam[];
  outputs?: AbiParam[];
  stateMutability?: string;
  constant?: boolean;
  payable?: boolean;
}

export type Mutability = "view" | "pure" | "nonpayable" | "payable";

/** Which ABI a function comes from: the contract's own ABI, or the ABI of its implementation (for a proxy). */
export type AbiSource = "own" | "implementation";

export interface Fn {
  /** Unique in the page: source + signature */
  id: string;
  kind: "function" | "fallback" | "receive";
  name: string;
  /** `transfer(address,uint256)` */
  signature: string;
  /** `0xa9059cbb`, or "" for fallback and receive */
  selector: string;
  mutability: Mutability;
  inputs: AbiParam[];
  outputs: AbiParam[];
  /** True if another function in the same ABI has the same name */
  overloaded: boolean;
  source: AbiSource;
  notice?: string;
  dev?: string;
  paramDocs: Record<string, string>;
  returnDocs: Record<string, string>;
}

export const isRead = (fn: Fn) => fn.mutability === "view" || fn.mutability === "pure";

/* ------------------------------------------------------------------ types */

/** `uint256[2][]` → element `uint256[2]`, length null (dynamic). Null if the type is not an array. */
export function arrayOf(type: string): { element: string; length: number | null } | null {
  const match = /^(.*)\[(\d*)\]$/.exec(type);
  if (!match) return null;
  return { element: match[1], length: match[2] === "" ? null : Number(match[2]) };
}

/** The parameter of one array item: same components, the element type, and the matching internal type. */
export function elementParam(param: AbiParam): AbiParam {
  const array = arrayOf(param.type)!;
  return {
    ...param,
    name: "",
    type: array.element,
    internalType: param.internalType?.replace(/\[\d*\]$/, ""),
  };
}

/** The canonical type for a signature: tuples are written as `(type1,type2)`. */
export function canonicalType(param: AbiParam): string {
  if (!param.type.startsWith("tuple")) return param.type;
  return `(${(param.components ?? []).map(canonicalType).join(",")})${param.type.slice("tuple".length)}`;
}

/** `struct ISwapRouter.ExactInputParams` → `ExactInputParams`; `enum ItemType` → `ItemType`. */
export function userTypeName(param: AbiParam): { kind: "struct" | "enum" | "contract"; name: string } | null {
  const match = /^(struct|enum|contract) ([\w.$]+)/.exec(param.internalType ?? "");
  if (!match) return null;
  return { kind: match[1] as "struct" | "enum" | "contract", name: match[2].split(".").pop()! };
}

/** The type as a person reads it: `ExactInputParams` for a struct, `ItemType (uint8)` for an enum. */
export function displayType(param: AbiParam): string {
  const user = userTypeName(param);
  const suffix = /(\[\d*\])+$/.exec(param.type)?.[0] ?? "";
  if (user?.kind === "struct") return `${user.name}${suffix}`;
  if (user?.kind === "enum") return `${user.name}${suffix}`;
  return param.type;
}

/* ------------------------------------------------- build the function list */

interface NatSpecDocs {
  userdoc?: Record<string, unknown>;
  devdoc?: Record<string, unknown>;
}

function mutabilityOf(entry: AbiEntry): Mutability {
  const declared = entry.stateMutability;
  if (declared === "view" || declared === "pure" || declared === "payable" || declared === "nonpayable")
    return declared;
  // ABIs of old compilers have `constant` and `payable` flags and no stateMutability
  if (entry.constant) return "view";
  return entry.payable ? "payable" : "nonpayable";
}

/** The functions of an ABI (and fallback/receive), with selectors and NatSpec. */
export function buildFunctions(abi: AbiEntry[] | undefined, docs: NatSpecDocs, source: AbiSource): Fn[] {
  const entries = abi ?? [];
  const userMethods = (docs.userdoc?.methods ?? {}) as Record<string, { notice?: string }>;
  const devMethods = (docs.devdoc?.methods ?? {}) as Record<
    string,
    { details?: string; params?: Record<string, string>; returns?: Record<string, string> }
  >;
  const nameCount = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type === "function" && entry.name) nameCount.set(entry.name, (nameCount.get(entry.name) ?? 0) + 1);
  }

  const functions: Fn[] = [];
  for (const entry of entries) {
    if (entry.type === "function" && entry.name) {
      const inputs = entry.inputs ?? [];
      const signature = `${entry.name}(${inputs.map(canonicalType).join(",")})`;
      functions.push({
        id: `${source}:${signature}`,
        kind: "function",
        name: entry.name,
        signature,
        selector: keccak256(toBytes(signature)).slice(0, 10),
        mutability: mutabilityOf(entry),
        inputs,
        outputs: entry.outputs ?? [],
        overloaded: (nameCount.get(entry.name) ?? 0) > 1,
        source,
        notice: userMethods[signature]?.notice,
        dev: devMethods[signature]?.details,
        paramDocs: devMethods[signature]?.params ?? {},
        returnDocs: devMethods[signature]?.returns ?? {},
      });
    } else if (entry.type === "fallback" || entry.type === "receive") {
      const isFallback = entry.type === "fallback";
      functions.push({
        id: `${source}:${entry.type}`,
        kind: entry.type,
        name: entry.type,
        signature: `${entry.type}()`,
        selector: "",
        mutability: mutabilityOf(entry),
        // A fallback takes any calldata. A receive function takes none.
        inputs: isFallback ? [{ name: "calldata", type: "bytes" }] : [],
        outputs: [],
        overloaded: false,
        source,
        notice: isFallback
          ? "Runs when a call matches no other function. You send raw calldata."
          : "Runs when the contract gets ether with empty calldata.",
        paramDocs: {},
        returnDocs: {},
      });
    }
  }
  return functions;
}

/* ------------------------------------------------------------ form values */

/**
 * The value of one input in a form. Text for most types, a boolean for bool,
 * a list for an array, and a list in component order for a tuple.
 */
export type FormValue = string | boolean | FormValue[];

export function emptyValue(param: AbiParam): FormValue {
  const array = arrayOf(param.type);
  if (array) {
    const element = elementParam(param);
    return Array.from({ length: array.length ?? 0 }, () => emptyValue(element));
  }
  if (param.type === "tuple") return (param.components ?? []).map(emptyValue);
  if (param.type === "bool") return false;
  return "";
}

const POW = (bits: number) => BigInt(2) ** BigInt(bits);

/** The problem with a single (non-array, non-tuple) value, or null. An empty value is "missing", not a problem. */
export function leafError(type: string, value: FormValue): string | null {
  if (type === "bool") return null;
  if (typeof value !== "string") return "Unexpected value";
  if (type === "string") return null;
  const text = value.trim();
  if (text === "") return null;

  if (type === "address") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(text)) {
      if (!text.startsWith("0x")) return "An address starts with 0x.";
      const digits = text.length - 2;
      if (/^0x[0-9a-fA-F]*$/.test(text)) return `An address has 40 hex characters after 0x. This value has ${digits}.`;
      return "An address has only the characters 0-9 and a-f.";
    }
    const body = text.slice(2);
    const isMixedCase = body !== body.toLowerCase() && body !== body.toUpperCase();
    // viem's getAddress does not check a checksum (it computes one); isAddress with strict does
    if (isMixedCase && !isAddress(text, { strict: true }))
      return "The checksum does not match. One or more characters are wrong, or have the wrong case.";
    return null;
  }

  const integer = /^(u?)int(\d*)$/.exec(type);
  if (integer) {
    const bits = Number(integer[2] || 256);
    const unsigned = integer[1] === "u";
    if (!/^-?\d+$/.test(text) && !/^0x[0-9a-fA-F]+$/.test(text))
      return "Enter a whole number, without spaces or commas.";
    let number: bigint;
    try {
      number = BigInt(text);
    } catch {
      return "Enter a whole number.";
    }
    if (unsigned) {
      if (number < BigInt(0)) return `${type} cannot be negative.`;
      if (number >= POW(bits)) return `Too large for ${type}. The maximum is 2^${bits} − 1.`;
    } else {
      if (number >= POW(bits - 1)) return `Too large for ${type}. The maximum is 2^${bits - 1} − 1.`;
      if (number < -POW(bits - 1)) return `Too small for ${type}. The minimum is −2^${bits - 1}.`;
    }
    return null;
  }

  const bytes = /^bytes(\d*)$/.exec(type);
  if (bytes) {
    if (!text.startsWith("0x")) return "Hex data starts with 0x.";
    if (!/^0x[0-9a-fA-F]*$/.test(text)) return "Hex data has only the characters 0-9 and a-f.";
    const digits = text.length - 2;
    if (digits % 2 !== 0) return `Hex data has an even number of characters. This value has ${digits}.`;
    if (bytes[1] !== "" && digits / 2 !== Number(bytes[1]))
      return `${type} is exactly ${bytes[1]} bytes (${Number(bytes[1]) * 2} hex characters). This value is ${digits / 2} bytes.`;
    return null;
  }
  return null;
}

/** Counts of missing and wrong values in the form, through all tuples and arrays. */
export function checkForm(params: AbiParam[], values: FormValue[]): { missing: number; invalid: number } {
  let missing = 0;
  let invalid = 0;
  const visit = (param: AbiParam, value: FormValue) => {
    const array = arrayOf(param.type);
    if (array) {
      const element = elementParam(param);
      for (const item of Array.isArray(value) ? value : []) visit(element, item);
      return;
    }
    if (param.type === "tuple") {
      (param.components ?? []).forEach((component, i) => visit(component, Array.isArray(value) ? value[i] : ""));
      return;
    }
    if (param.type === "bool" || param.type === "string") return;
    if (typeof value !== "string" || value.trim() === "") missing++;
    else if (leafError(param.type, value)) invalid++;
  };
  params.forEach((param, i) => visit(param, values[i]));
  return { missing, invalid };
}

/* ------------------------------------------------------------------- JSON */

/** The form value as JSON: a tuple becomes an object with the field names (or a list if a field has no name). */
export function toJson(param: AbiParam, value: FormValue): unknown {
  const array = arrayOf(param.type);
  if (array) {
    const element = elementParam(param);
    return (Array.isArray(value) ? value : []).map((item) => toJson(element, item));
  }
  if (param.type === "tuple") {
    const components = param.components ?? [];
    const items = components.map((component, i) => toJson(component, Array.isArray(value) ? value[i] : ""));
    if (components.some((component) => !component.name)) return items;
    return Object.fromEntries(components.map((component, i) => [component.name, items[i]]));
  }
  return value;
}

/**
 * JSON.parse, but every number becomes text first, so that large integers stay exact
 * (JSON.parse turns 12345678901234567891 into 12345678901234567000).
 */
export function parseJsonExact(text: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      out += char;
      if (char === "\\") {
        out += text[i + 1] ?? "";
        i++;
      } else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    const number = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (number && (char === "-" || /\d/.test(char))) {
      out += `"${number[0]}"`;
      i += number[0].length - 1;
      continue;
    }
    out += char;
  }
  return JSON.parse(out);
}

/** Reads pasted JSON into a form value. Throws an Error with a message for the user. */
export function fromJson(param: AbiParam, json: unknown, path = param.name || "value"): FormValue {
  const array = arrayOf(param.type);
  if (array) {
    if (!Array.isArray(json)) throw new Error(`"${path}" must be a list: [ … ]`);
    if (array.length !== null && json.length !== array.length)
      throw new Error(`"${path}" must have exactly ${array.length} items. The JSON has ${json.length}.`);
    const element = elementParam(param);
    return json.map((item, i) => fromJson(element, item, `${path}[${i}]`));
  }
  if (param.type === "tuple") {
    const components = param.components ?? [];
    if (Array.isArray(json)) {
      if (json.length !== components.length)
        throw new Error(`"${path}" has ${components.length} fields. The JSON list has ${json.length}.`);
      return components.map((component, i) => fromJson(component, json[i], `${path}.${component.name || i}`));
    }
    if (json === null || typeof json !== "object") throw new Error(`"${path}" must be an object: { … }`);
    const record = json as Record<string, unknown>;
    return components.map((component, i) => {
      const key = component.name || String(i);
      if (!(key in record)) throw new Error(`"${path}" has no field "${key}".`);
      return fromJson(component, record[key], `${path}.${key}`);
    });
  }
  if (param.type === "bool") {
    if (typeof json === "boolean") return json;
    if (json === "true" || json === "false") return json === "true";
    throw new Error(`"${path}" must be true or false.`);
  }
  if (typeof json === "string") return json;
  if (typeof json === "number" || typeof json === "bigint") return String(json);
  throw new Error(`"${path}" must be text or a number.`);
}

/* --------------------------------------------------------------- calldata */

/** The value in the shape that the ABI encoder wants. */
function toEncoderValue(param: AbiParam, value: FormValue): unknown {
  const array = arrayOf(param.type);
  if (array) {
    const element = elementParam(param);
    return (value as FormValue[]).map((item) => toEncoderValue(element, item));
  }
  if (param.type === "tuple")
    return (param.components ?? []).map((component, i) => toEncoderValue(component, (value as FormValue[])[i]));
  if (param.type === "bool") return value === true;
  if (param.type === "string") return value;
  const text = String(value).trim();
  // viem wants a bigint for every integer type, and a checksum address or lower case
  if (/^u?int\d*$/.test(param.type)) return BigInt(text);
  if (param.type === "address") return text.slice(2) === text.slice(2).toUpperCase() ? text.toLowerCase() : text;
  return text;
}

/** The calldata of a call, or null if the form is not complete. */
export function encodeCall(fn: Fn, values: FormValue[]): string | null {
  try {
    if (fn.kind === "receive") return "0x";
    if (fn.kind === "fallback") return String(values[0] || "0x");
    // An ABI with only this function: overloaded functions need no lookup by argument types
    const abi = [
      { type: "function", name: fn.name, inputs: fn.inputs, outputs: fn.outputs, stateMutability: fn.mutability },
    ] as Abi;
    return encodeFunctionData({
      abi,
      functionName: fn.name,
      args: fn.inputs.map((input, i) => toEncoderValue(input, values[i])),
    });
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- big numbers */

/** `1234567` → `1,234,567` */
export function groupDigits(digits: string): string {
  const negative = digits.startsWith("-");
  const body = negative ? digits.slice(1) : digits;
  return (negative ? "-" : "") + body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The integer divided by 10^decimals, as exact decimal text: (`1500000`, 6) → `1.5` */
export function shiftDecimal(integer: string, decimals: number): string {
  if (decimals === 0) return groupDigits(integer);
  const negative = integer.startsWith("-");
  const digits = (negative ? integer.slice(1) : integer).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return (negative ? "-" : "") + groupDigits(whole) + (fraction ? `.${fraction}` : "");
}

/** Decimal text times 10^decimals, as an integer: (`1.5`, 18) → `1500000000000000000`. Null if it does not fit. */
export function scaleDecimal(text: string, decimals: number): string | null {
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match || (match[2] === "" && !match[3])) return null;
  const fraction = match[3] ?? "";
  if (fraction.length > decimals) return null;
  const digits = (match[2] + fraction.padEnd(decimals, "0")).replace(/^0+(?=\d)/, "");
  return (match[1] && digits !== "0" ? "-" : "") + digits;
}

export const shortHex = (value: string, head = 6, tail = 4) =>
  value.length <= 2 + head + tail + 1 ? value : `${value.slice(0, 2 + head)}…${value.slice(-tail)}`;
