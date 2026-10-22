import { keccak256 } from "@ethersproject/keccak256";

/**
 * Function selectors and event topics for declarations in the source.
 *
 * The compiler's signatures (the `signatures` field of the Sourcify API) are
 * exact, but only cover the main contract's ABI. For other declarations the
 * selector is computed here, but only when every parameter type can be made
 * canonical without full type resolution: built-in types, contracts and
 * interfaces (address), and enums (uint8). Structs and user-defined value
 * types need the compiler's type information, so they give no selector.
 */

export interface CompilerSignature {
  signature: string;
  signatureHash4: string;
  signatureHash32: string;
}

// What a user-defined type name stands for in an ABI signature
export type UserTypeResolver = (name: string) => "address" | "uint8" | undefined;

const INTEGER_SIZES = new Set(Array.from({ length: 32 }, (_, i) => String((i + 1) * 8)));

function canonicalBase(base: string, resolve: UserTypeResolver): string | undefined {
  if (base === "uint" || base === "int") return `${base}256`;
  if (base === "byte") return "bytes1";
  if (base === "address" || base === "address payable" || base === "bool" || base === "string" || base === "bytes")
    return base === "address payable" ? "address" : base;
  const integer = /^(u?int)(\d+)$/.exec(base);
  if (integer) return INTEGER_SIZES.has(integer[2]) ? base : undefined;
  const fixedBytes = /^bytes(\d+)$/.exec(base);
  if (fixedBytes) return Number(fixedBytes[1]) >= 1 && Number(fixedBytes[1]) <= 32 ? base : undefined;
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(base)) return resolve(base.split(".").pop()!);
  return undefined;
}

/** The ABI type for a parameter type as written in the source, or undefined if it cannot be known here. */
export function canonicalType(type: string, resolve: UserTypeResolver = () => undefined): string | undefined {
  const text = type.replace(/\s+/g, " ").trim();
  const match = /^(.*?)((?:\s*\[\s*\d*\s*\])*)$/.exec(text);
  if (!match) return undefined;
  const base = canonicalBase(match[1].trim(), resolve);
  if (!base) return undefined;
  return base + match[2].replace(/\s+/g, "");
}

/** `name(type1,type2)` with canonical types, or undefined if a type is unknown. */
export function canonicalSignature(name: string, types: string[], resolve?: UserTypeResolver): string | undefined {
  const canonical = types.map((type) => canonicalType(type, resolve));
  if (canonical.some((type) => type === undefined)) return undefined;
  return `${name}(${canonical.join(",")})`;
}

export function hashSignature(signature: string): string {
  return keccak256(new TextEncoder().encode(signature));
}

export const selectorOf = (signature: string) => hashSignature(signature).slice(0, 10);

/** The parameter types of a signature like `f(uint256,(address,bool),bytes[])`, split at top-level commas. */
export function signatureParameters(signature: string): { name: string; types: string[] } {
  const open = signature.indexOf("(");
  const name = signature.slice(0, open);
  const inner = signature.slice(open + 1, signature.lastIndexOf(")"));
  const types: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of inner) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      types.push(current);
      current = "";
    } else current += char;
  }
  if (current) types.push(current);
  return { name, types };
}

/**
 * The compiler signature for a declaration: same name, same number of
 * parameters, and the same type at every position where the type is known.
 */
export function findCompilerSignature(
  name: string,
  types: string[],
  signatures: CompilerSignature[],
  resolve?: UserTypeResolver
): CompilerSignature | undefined {
  const candidates = signatures.filter((entry) => {
    const parsed = signatureParameters(entry.signature);
    return parsed.name === name && parsed.types.length === types.length;
  });
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((entry) => {
    const parsed = signatureParameters(entry.signature);
    return types.every((type, i) => {
      const canonical = canonicalType(type, resolve);
      return canonical === undefined || canonical === parsed.types[i];
    });
  });
}

/**
 * The parameter types of the getter of a public state variable:
 * one per mapping key, and uint256 per array dimension.
 */
export function getterParameters(type: string): string[] {
  const parameters: string[] = [];
  let rest = type.replace(/\s+/g, " ").trim();
  for (;;) {
    const mapping = /^mapping\s*\(/.exec(rest);
    if (mapping) {
      const inner = rest.slice(mapping[0].length, rest.lastIndexOf(")"));
      const arrow = inner.indexOf("=>");
      if (arrow === -1) break;
      // A named key, as in "mapping(address owner => uint256)", keeps only its type
      parameters.push(inner.slice(0, arrow).trim().split(" ")[0]);
      rest = inner.slice(arrow + 2).trim();
      continue;
    }
    const array = /\[\s*\d*\s*\]$/.exec(rest);
    if (array) {
      parameters.push("uint256");
      rest = rest.slice(0, array.index).trim();
      continue;
    }
    break;
  }
  return parameters;
}
