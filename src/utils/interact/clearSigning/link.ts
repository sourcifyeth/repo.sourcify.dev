/**
 * Links an input model of the clear signing SDK (one function of an ERC-7730 descriptor) to a function of the
 * verified ABI. The model says how each input looks (label, format, order). The values stay in the form of the
 * ABI (see abi.ts), so both forms of a function share one set of values and one encoder.
 *
 * The link is by argument position: the descriptor's names can differ from the names of the verified ABI.
 * If anything does not fit (signature, a path, an input that the model does not show), there is no link,
 * and the function keeps its ABI form.
 */
import type { InputField, InputFieldGroup, InputModel } from "@ethereum-sourcify/clear-signing/builder";
import { type AbiParam, type Fn, type FormValue, arrayOf, elementParam } from "../abi";
import {
  type PathStep,
  type SigParam,
  canonicalSignature,
  hasUniqueNames,
  parseSignature,
  resolvePath,
  stepsKey,
} from "./signature";

/** Where the token of a `tokenAmount` field is. */
export type TokenRef =
  /** The contract itself (`@.to`) */
  | { kind: "contract" }
  | { kind: "constant"; address: string }
  /** The address is the value of another input */
  | { kind: "input"; steps: PathStep[] }
  /** A map of the descriptor, with another input as the key */
  | { kind: "map"; steps: PathStep[]; values: Record<string, string> };

/** How one input looks in the descriptor form. */
export interface Presentation {
  label: string;
  /** False for an input that the descriptor does not describe: the label is then the name of the ABI */
  described: boolean;
  format?: string;
  /** `enum`: raw value → label */
  options?: Record<string, string>;
  /** `unit`: decimal places and the unit text, e.g. 4 and "%" */
  decimals?: number;
  base?: string;
  /** `tokenAmount`: where the token is; null if the page cannot find it */
  token?: TokenRef | null;
  /** `tokenAmount`: token addresses that mean the native currency of the chain */
  nativeAddresses?: string[];
  /** `tokenAmount`, `amount`: at or above this value a wallet shows `message` ("Unlimited") */
  threshold?: string;
  message?: string;
  /** `date`: "timestamp" (default) or "blockheight" */
  encoding?: string;
}

export type LinkedItem =
  /**
   * One input of the function, or a part of one, at `steps`. `param` is the ABI parameter there: a single
   * value, or a whole struct or list. `overlay`: for a list, how the values inside each element look.
   */
  | { kind: "input"; steps: number[]; param: AbiParam; presentation: Presentation; overlay?: Overlay }
  /** The native value of the transaction (`@.value`) */
  | { kind: "value"; presentation: Presentation }
  /** A fixed text of the descriptor; it takes no input */
  | { kind: "constant"; label: string; value: string }
  | { kind: "group"; label?: string; items: LinkedItem[] };

/** Presentations of the values inside a struct or list, by their steps from that value ("[].1"). */
export type Overlay = Map<string, Presentation>;

export interface LinkedModel {
  model: InputModel;
  /** The descriptor's short text for the function, e.g. "Approve" */
  intent?: string;
  /** The descriptor's own names and types of the arguments, for the SDK's encoder */
  inputs: SigParam[];
  /** In the display order of the descriptor */
  items: LinkedItem[];
  /** True if the model has a field for the native value */
  hasValue: boolean;
}

/* ------------------------------------------------------------ value access */

/** The ABI parameter at the steps. A step into a list gives the parameter of one element. */
export function paramAt(inputs: AbiParam[], steps: PathStep[]): AbiParam | null {
  let scope: AbiParam[] | undefined = inputs;
  let param: AbiParam | null = null;
  for (const step of steps) {
    if (typeof step === "number") {
      if (param) {
        if (param.type !== "tuple") return null;
        scope = param.components;
      }
      param = scope?.[step] ?? null;
      if (!param) return null;
    } else {
      if (!param || !arrayOf(param.type)) return null;
      param = elementParam(param);
    }
  }
  return param;
}

/** The form value at the steps ("[]" is not a single value: undefined). */
export function valueAt(values: FormValue[], steps: PathStep[]): FormValue | undefined {
  let current: FormValue | undefined = values;
  for (const step of steps) {
    if (!Array.isArray(current) || step === "[]") return undefined;
    current = typeof step === "number" ? current[step] : current.at(step.index);
  }
  return current;
}

/** A copy of the form values with the value at the steps replaced. */
export function withValueAt(values: FormValue[], steps: number[], next: FormValue): FormValue[] {
  const [head, ...rest] = steps;
  return values.map((value, i) =>
    i !== head ? value : rest.length === 0 ? next : withValueAt(Array.isArray(value) ? value : [], rest, next)
  );
}

/* ------------------------------------------------------------------- link */

const lower = (value: unknown) => (typeof value === "string" ? value.toLowerCase() : undefined);

function tokenRef(field: InputField, inputs: SigParam[]): TokenRef | null {
  const params = field.params ?? {};
  if (typeof params.tokenPath === "string") {
    if (params.tokenPath === "@.to") return { kind: "contract" };
    if (params.tokenPath.startsWith("@.")) return null;
    const steps = resolvePath(inputs, params.tokenPath);
    return steps && !steps.includes("[]") ? { kind: "input", steps } : null;
  }
  const token = params.token;
  if (typeof token === "string") return { kind: "constant", address: token };
  if (token && typeof token === "object" && "keyPath" in token) {
    if (token.keyPath.startsWith("@.")) return null;
    const steps = resolvePath(inputs, token.keyPath);
    if (!steps || steps.includes("[]")) return null;
    const values = Object.fromEntries(
      Object.entries(token.values).flatMap(([key, value]) =>
        typeof value === "string" ? [[key.toLowerCase(), value]] : []
      )
    );
    return { kind: "map", steps, values };
  }
  return null;
}

function presentationOf(field: InputField, inputs: SigParam[], abiName: string | undefined): Presentation {
  const params = field.params ?? {};
  const lastName = field.path
    ?.split(".")
    .filter((segment) => !segment.startsWith("["))
    .pop();
  // The SDK appends each input that no descriptor field covers, with the descriptor's argument name as its label
  const described = !!field.format || field.hidden === true || field.label !== lastName;
  const native = params.nativeCurrencyAddress;
  return {
    label: described ? field.label : abiName || field.label,
    described,
    ...(field.format ? { format: field.format } : {}),
    ...(field.options ? { options: field.options } : {}),
    ...(typeof params.decimals === "number" ? { decimals: params.decimals } : {}),
    ...(typeof params.base === "string" ? { base: params.base } : {}),
    ...(field.format === "tokenAmount" ? { token: tokenRef(field, inputs) } : {}),
    ...(native
      ? { nativeAddresses: (Array.isArray(native) ? native : [native]).flatMap((address) => lower(address) ?? []) }
      : {}),
    ...(params.threshold !== undefined ? { threshold: String(params.threshold) } : {}),
    ...(typeof params.message === "string" ? { message: params.message } : {}),
    ...(typeof params.encoding === "string" ? { encoding: params.encoding } : {}),
  };
}

/** The values that a form must show: every single value and every list, outside of lists, by its steps. */
function formUnits(inputs: AbiParam[], prefix: number[] = []): number[][] {
  return inputs.flatMap((param, i) => {
    const steps = [...prefix, i];
    if (param.type === "tuple" && (param.components?.length ?? 0) > 0) return formUnits(param.components!, steps);
    return [steps];
  });
}

const startsWith = (steps: number[], prefix: number[]) => prefix.every((step, i) => steps[i] === step);

/**
 * The model linked to the function, or null if they do not fit. Null means "use the ABI form".
 * The caller matches model and function by selector first.
 */
export function linkModel(model: InputModel, fn: Fn): LinkedModel | null {
  const parsed = parseSignature(model.signature);
  if (!parsed || !hasUniqueNames(parsed.inputs)) return null;
  // The same selector with other types is a selector collision, or a broken descriptor
  if (canonicalSignature(parsed) !== fn.signature) return null;

  const roots = new Map<string, Extract<LinkedItem, { kind: "input" }>>();
  const shown: number[][] = [];
  let hasValue = false;
  let failed = false;

  const itemOf = (field: InputField): LinkedItem | null => {
    if (field.path === undefined) {
      return field.constant === undefined
        ? null
        : { kind: "constant", label: field.label, value: String(field.constant) };
    }
    if (field.path === "@.value") {
      // A descriptor can name the value of a function that takes none: nothing to enter then
      if (fn.mutability !== "payable" || hasValue) return null;
      hasValue = true;
      return { kind: "value", presentation: presentationOf(field, parsed.inputs, undefined) };
    }
    const steps = field.path.startsWith("@.") ? null : resolvePath(parsed.inputs, field.path);
    if (!steps || steps.some((step) => typeof step === "object")) {
      failed = true;
      return null;
    }
    const firstList = steps.indexOf("[]");
    const rootSteps = (firstList < 0 ? steps : steps.slice(0, firstList)) as number[];
    const param = paramAt(fn.inputs, rootSteps);
    const leaf = paramAt(fn.inputs, steps);
    if (!param || !leaf) {
      failed = true;
      return null;
    }
    const presentation = presentationOf(field, parsed.inputs, leaf.name);
    if (firstList < 0) {
      shown.push(rootSteps);
      return { kind: "input", steps: rootSteps, param, presentation };
    }
    // A value inside a list: the list is one input with add and remove, and this field describes a part of each element.
    // A token that is another value of the same element cannot be found from here: the field then takes the raw number.
    const inner: Presentation =
      presentation.token && (presentation.token.kind === "input" || presentation.token.kind === "map")
        ? { ...presentation, token: null }
        : presentation;
    const key = stepsKey(rootSteps);
    const existing = roots.get(key);
    if (existing) {
      existing.overlay!.set(stepsKey(steps.slice(firstList)), inner);
      return null;
    }
    const root: Extract<LinkedItem, { kind: "input" }> = {
      kind: "input",
      steps: rootSteps,
      param,
      presentation: { label: param.name || field.label, described: false },
      overlay: new Map([[stepsKey(steps.slice(firstList)), inner]]),
    };
    roots.set(key, root);
    shown.push(rootSteps);
    return root;
  };

  const isGroup = (item: InputField | InputFieldGroup): item is InputFieldGroup => "fields" in item;
  const items: LinkedItem[] = [];
  for (const entry of model.fields) {
    if (isGroup(entry)) {
      const inner = entry.fields.flatMap((field) => itemOf(field) ?? []);
      if (inner.length > 0) items.push({ kind: "group", ...(entry.label ? { label: entry.label } : {}), items: inner });
    } else {
      const item = itemOf(entry);
      if (item) items.push(item);
    }
  }
  if (failed) return null;

  // Every value of the function must be in the form exactly once: a form that hides an input cannot be filled
  for (const unit of formUnits(fn.inputs)) {
    if (shown.filter((steps) => startsWith(unit, steps)).length !== 1) return null;
  }

  return {
    model,
    ...(typeof model.intent === "string" && model.intent.trim() ? { intent: model.intent.trim() } : {}),
    inputs: parsed.inputs,
    items: tokenInputsFirst(items),
    hasValue,
  };
}

/**
 * Puts the inputs that hold a token address before the other inputs. An amount field needs the decimals of
 * its token: if the token is another input ("tokenIn"), the user must fill that input first. A descriptor
 * often lists the amount first (the order a wallet shows), so the form moves the token inputs to the top.
 * The other inputs keep the order of the descriptor. Inside a group, the same rule holds for the group.
 */
export function tokenInputsFirst(items: LinkedItem[]): LinkedItem[] {
  const tokenPaths: PathStep[][] = [];
  const collect = (list: LinkedItem[]) => {
    for (const item of list) {
      if (item.kind === "group") collect(item.items);
      else if (item.kind === "input") {
        const token = item.presentation.token;
        if (token && (token.kind === "input" || token.kind === "map")) tokenPaths.push(token.steps);
      }
    }
  };
  collect(items);
  if (tokenPaths.length === 0) return items;
  // An input holds the token if the token's path starts with the input's own steps
  const holdsToken = (item: LinkedItem) =>
    item.kind === "input" && tokenPaths.some((path) => item.steps.every((step, i) => path[i] === step));
  const order = (list: LinkedItem[]): LinkedItem[] => {
    const inner = list.map((item) => (item.kind === "group" ? { ...item, items: order(item.items) } : item));
    return [...inner.filter(holdsToken), ...inner.filter((item) => !holdsToken(item))];
  };
  return order(items);
}

/** The linked model of each function that has one, by function id. Model and function match by selector. */
export function linkModels(models: InputModel[], functions: Fn[]): Map<string, LinkedModel> {
  const bySelector = new Map(models.map((model) => [model.selector.toLowerCase(), model]));
  const linked = new Map<string, LinkedModel>();
  for (const fn of functions) {
    const model = fn.kind === "function" ? bySelector.get(fn.selector.toLowerCase()) : undefined;
    const link = model ? linkModel(model, fn) : null;
    if (link) linked.set(fn.id, link);
  }
  return linked;
}

/**
 * The token address of a `tokenAmount` field with the current form values, in lower case.
 * "native" for the chain's own currency. Null if the address is not known yet.
 */
export function tokenAddressOf(
  presentation: Presentation,
  values: FormValue[],
  contract: string
): string | "native" | null {
  const ref = presentation.token;
  if (!ref) return null;
  let address: string | undefined;
  if (ref.kind === "contract") address = contract;
  else if (ref.kind === "constant") address = ref.address;
  else {
    const value = valueAt(values, ref.steps);
    const text = typeof value === "string" ? value.trim().toLowerCase() : "";
    address = ref.kind === "input" ? text : ref.values[text];
  }
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const normal = address.toLowerCase();
  return presentation.nativeAddresses?.includes(normal) ? "native" : normal;
}
