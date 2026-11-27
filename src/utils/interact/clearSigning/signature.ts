/**
 * Function signatures of ERC-7730 descriptors, e.g.
 * `exactInputSingle((address tokenIn, uint256 amountIn) params)`, and the paths of descriptor fields
 * (`params.amountIn`, `orders.[].amount`, `path.[-1]`).
 *
 * A descriptor has its own argument names. They can differ from the names in the verified ABI
 * (`_to` and `to`), so the page links a descriptor field to a form input by position, not by name.
 */

/** One parameter of a descriptor signature. */
export interface SigParam {
  /** The name in the descriptor; `param<i>` if it has none (as the SDK names it) */
  name: string;
  /** The type without array suffixes: `uint256`, `address`, or `tuple` */
  base: string;
  /** The array dimensions in order, e.g. `uint256[2][]` → [2, null] (null: dynamic) */
  dims: Array<number | null>;
  components?: SigParam[];
}

export interface ParsedSignature {
  name: string;
  inputs: SigParam[];
}

/**
 * One step from a value to a value inside it:
 * a number: the component of a tuple (or the argument of the function) at this position;
 * "[]": every element of an array; { index }: one element of an array (negative: from the end).
 */
export type PathStep = number | "[]" | { index: number };

const MODIFIERS = new Set(["memory", "calldata", "storage", "payable", "indexed"]);

/** Parses a descriptor signature. Null if the text is not a function signature. */
export function parseSignature(signature: string): ParsedSignature | null {
  const text = signature.trim();
  const open = text.indexOf("(");
  if (open <= 0) return null;
  const name = text.slice(0, open).trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
  let i = open;

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const word = () => {
    const match = /^[\w$]+/.exec(text.slice(i));
    if (!match) return "";
    i += match[0].length;
    return match[0];
  };

  // At "(": reads the list up to the matching ")"
  const list = (): SigParam[] | null => {
    i++;
    const params: SigParam[] = [];
    skipSpace();
    if (text[i] === ")") {
      i++;
      return params;
    }
    for (;;) {
      skipSpace();
      let base: string;
      let components: SigParam[] | undefined;
      if (text[i] === "(") {
        const inner = list();
        if (!inner) return null;
        components = inner;
        base = "tuple";
      } else {
        base = word();
        if (!base) return null;
        // `tuple(...)` is another spelling of `(...)`
        if (base === "tuple" && text[i] === "(") {
          const inner = list();
          if (!inner) return null;
          components = inner;
        }
        if (base === "uint") base = "uint256";
        if (base === "int") base = "int256";
      }
      const dims: Array<number | null> = [];
      for (;;) {
        const dim = /^\[(\d*)\]/.exec(text.slice(i));
        if (!dim) break;
        dims.push(dim[1] === "" ? null : Number(dim[1]));
        i += dim[0].length;
      }
      let paramName = "";
      for (;;) {
        skipSpace();
        const next = word();
        if (!next) break;
        if (!MODIFIERS.has(next)) paramName = next;
      }
      params.push({ name: paramName || `param${params.length}`, base, dims, ...(components ? { components } : {}) });
      skipSpace();
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === ")") {
        i++;
        return params;
      }
      return null;
    }
  };

  const inputs = list();
  if (!inputs) return null;
  skipSpace();
  if (i !== text.length) return null;
  return { name, inputs };
}

/** `(address,uint256)[]` for a tuple array, `uint256` for a plain type: the type as it is in a selector. */
export function canonicalSigType(param: SigParam): string {
  const base = param.components ? `(${param.components.map(canonicalSigType).join(",")})` : param.base;
  return base + param.dims.map((dim) => (dim === null ? "[]" : `[${dim}]`)).join("");
}

/** `transfer(address,uint256)` */
export function canonicalSignature(parsed: ParsedSignature): string {
  return `${parsed.name}(${parsed.inputs.map(canonicalSigType).join(",")})`;
}

/** True if no two arguments, and no two components of one tuple, have the same name. */
export function hasUniqueNames(params: SigParam[]): boolean {
  const names = new Set(params.map((param) => param.name));
  if (names.size !== params.length) return false;
  return params.every((param) => !param.components || hasUniqueNames(param.components));
}

/**
 * The steps from the function arguments to the value that a descriptor path names.
 * `params.amountIn` → [0, 4]; `orders.[].amount` → [0, "[]", 1]; `path.[-1]` → [2, { index: -1 }].
 * Null if the path names no value of the signature (also for byte slices such as `data.[:4]`).
 */
export function resolvePath(inputs: SigParam[], path: string): PathStep[] | null {
  const steps: PathStep[] = [];
  let scope: SigParam[] | null = inputs;
  let node: SigParam | null = null;
  // How many array dimensions of `node` are still around the current value. The outer dimension is the last one.
  let depth = 0;
  for (const segment of path.replace(/^#\./, "").split(".")) {
    const index = /^\[(-?\d*)\]$/.exec(segment);
    if (index) {
      if (!node || depth === 0) return null;
      depth--;
      steps.push(index[1] === "" ? "[]" : { index: Number(index[1]) });
      continue;
    }
    if (node) {
      if (depth > 0 || !node.components) return null;
      scope = node.components;
    }
    if (!scope) return null;
    const position: number = scope.findIndex((param) => param.name === segment);
    if (position < 0) return null;
    node = scope[position];
    depth = node.dims.length;
    steps.push(position);
  }
  return node ? steps : null;
}

/** "0.4", "0.[].1", "2.[-1]": a text key for a list of steps. */
export const stepsKey = (steps: PathStep[]) =>
  steps.map((step) => (typeof step === "number" ? String(step) : step === "[]" ? "[]" : `[${step.index}]`)).join(".");
