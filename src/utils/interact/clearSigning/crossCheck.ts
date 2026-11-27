/**
 * The second encoder. viem builds the calldata from the verified ABI. The clear signing SDK builds it again
 * from the descriptor's own signature. The page sends only if both give the same bytes, so a bug in one
 * encoder, or a descriptor with a wrong signature, cannot reach the wallet unnoticed.
 */
import type { InputModel } from "@ethereum-sourcify/clear-signing/builder";
import { type AbiParam, type FormValue, arrayOf, elementParam } from "../abi";
import type { SigParam } from "./signature";

type BuildCalldata = (model: InputModel, values: Record<string, unknown>) => { data: string } | { errors: unknown[] };

function toSdkValue(sig: SigParam, param: AbiParam, value: FormValue | undefined): unknown {
  if (arrayOf(param.type)) {
    const element = elementParam(param);
    const inner: SigParam = { ...sig, dims: sig.dims.slice(0, -1) };
    return (Array.isArray(value) ? value : []).map((item) => toSdkValue(inner, element, item));
  }
  if (param.type === "tuple") {
    const fields = Array.isArray(value) ? value : [];
    return Object.fromEntries(
      (sig.components ?? []).map((component, i) => [
        component.name,
        toSdkValue(component, (param.components ?? [])[i], fields[i]),
      ])
    );
  }
  if (param.type === "bool") return value === true;
  if (param.type === "string") return typeof value === "string" ? value : "";
  const text = String(value ?? "").trim();
  if (param.type === "bytes" && text === "") return "0x";
  return text;
}

/**
 * The form values in the shape that `buildCalldata` of the SDK takes: an object with the descriptor's argument
 * names; a struct is an object, a list is an array, numbers are decimal text.
 */
export function toSdkValues(inputs: SigParam[], params: AbiParam[], values: FormValue[]): Record<string, unknown> {
  return Object.fromEntries(inputs.map((sig, i) => [sig.name, toSdkValue(sig, params[i], values[i])]));
}

export type CrossCheck = { ok: true } | { ok: false; detail: string };

/** Encodes the same values with the SDK and compares with the calldata of viem. */
export function crossCheck(
  model: InputModel,
  inputs: SigParam[],
  params: AbiParam[],
  values: FormValue[],
  viemCalldata: string,
  build: BuildCalldata
): CrossCheck {
  let result: ReturnType<BuildCalldata>;
  try {
    result = build(model, toSdkValues(inputs, params, values));
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
  if ("errors" in result) {
    const first = result.errors[0] as { path?: string; message?: string } | undefined;
    return {
      ok: false,
      detail: `the SDK refused the values${first?.message ? `: ${first.path} ${first.message}` : ""}`,
    };
  }
  return result.data.toLowerCase() === viemCalldata.toLowerCase()
    ? { ok: true }
    : { ok: false, detail: "the calldata of the two encoders is different" };
}
