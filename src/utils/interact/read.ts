/**
 * One read of a contract function: encode the call, ask two RPC endpoints at one block,
 * decode the answers, and say whether the endpoints agree.
 */
import { type Fn, type FormValue, encodeCall } from "./abi";
import { decodeOutputs, decodeRevert } from "./decode";
import { type Answer, type RpcOptions, readFromSources } from "./rpcRead";
import type { CallContext, CallError, CallOutcome, MismatchSide, RpcEndpoint, SourceResult } from "./types";

type Decoded = { values: FormValue[] } | { error: CallError };

function decodeAnswer(fn: Fn, answer: Answer, ctx: CallContext): Decoded {
  if (answer.kind === "revert") return { error: decodeRevert(answer.data, ctx.errorAbi) };
  try {
    return { values: decodeOutputs(fn, answer.data) };
  } catch {
    return { error: { kind: "bad-result", raw: answer.data } };
  }
}

/**
 * Reads a view or pure function. `from` is the connected wallet, if any: some functions read msg.sender.
 * Never throws for network problems; they come back as an outcome with status "error".
 */
export async function readFunction(
  fn: Fn,
  values: FormValue[],
  ctx: CallContext,
  endpoints: RpcEndpoint[],
  from?: string,
  options: RpcOptions = {}
): Promise<CallOutcome> {
  const data = encodeCall(fn, values);
  if (!data) throw new Error("The form is not complete");
  const asked = endpoints.slice(0, 2);
  const result = await readFromSources(
    asked.map((endpoint) => endpoint.url),
    { to: ctx.address, data, ...(from ? { from } : {}) },
    options
  );
  const at = Date.now();
  const sources: SourceResult[] = result.sources.map((source, i) => ({
    endpoint: asked[i],
    ms: source.ms,
    ok: source.ok,
    ...(source.ok ? { raw: source.answer.data } : { problem: source.problem }),
  }));

  if (result.check === "all-failed") return { status: "error", at, error: { kind: "all-failed", sources } };

  if (result.check === "mismatch") {
    const sides: MismatchSide[] = result.sources.flatMap((source, i) =>
      source.ok ? [{ host: asked[i].host, ...decodeAnswer(fn, source.answer, ctx) }] : []
    );
    const first = sides[0];
    return {
      status: "success",
      values: first && "values" in first && first.values ? first.values : [],
      raw: result.answer.data,
      block: result.block,
      at,
      sources,
      check: "mismatch",
      sides,
    };
  }

  const decoded = decodeAnswer(fn, result.answer, ctx);
  if ("error" in decoded) return { status: "error", at, block: result.block, error: decoded.error, sources };
  return {
    status: "success",
    values: decoded.values,
    raw: result.answer.data,
    block: result.block,
    at,
    sources,
    check: result.check,
  };
}
