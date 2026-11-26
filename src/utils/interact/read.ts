/**
 * One read of a contract function: encode the call, ask two RPC endpoints at one block,
 * decode the answers, and say whether the endpoints agree.
 */
import { type Fn, type FormValue, encodeCall } from "./abi";
import { decodeOutputs, decodeRevert } from "./decode";
import { type Answer, type HeadGap, type RpcOptions, isLargeGap, readFromSources } from "./rpcRead";
import type { CallContext, CallError, CallOutcome, MismatchSide, ReadGap, RpcEndpoint, SourceResult } from "./types";

type Decoded = { values: FormValue[] } | { error: CallError };

function decodeAnswer(fn: Fn, answer: Answer, ctx: CallContext): Decoded {
  if (answer.kind === "revert") return { error: decodeRevert(answer.data, ctx.errorAbi) };
  try {
    return { values: decodeOutputs(fn, answer.data) };
  } catch {
    return { error: { kind: "bad-result", raw: answer.data } };
  }
}

/** The gap between the two newest blocks, with host names for the page. */
function gapOf(gap: HeadGap | undefined, asked: RpcEndpoint[]): ReadGap | undefined {
  if (!gap) return undefined;
  const host = (url: string) => asked.find((endpoint) => endpoint.url === url)?.host ?? url;
  return {
    behind: host(gap.behindUrl),
    ahead: host(gap.aheadUrl),
    behindHead: gap.behindHead,
    aheadHead: gap.aheadHead,
    blocks: gap.blocks,
    ...(gap.ageSeconds !== undefined ? { ageSeconds: gap.ageSeconds } : {}),
    large: isLargeGap(gap),
  };
}

/**
 * Reads a view or pure function. `from` is the sender, only where a function needs one: the page sends
 * the proxy admin for a transparent proxy's own functions, and no sender otherwise.
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
    ...(source.head !== undefined ? { head: source.head } : {}),
  }));

  if (result.check === "all-failed") return { status: "error", at, error: { kind: "all-failed", sources } };
  const gap = gapOf(result.gap, asked);
  const withGap = gap ? { gap } : {};

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
      ...withGap,
    };
  }

  const decoded = decodeAnswer(fn, result.answer, ctx);
  if ("error" in decoded)
    return { status: "error", at, block: result.block, error: decoded.error, sources, ...withGap };
  return {
    status: "success",
    values: decoded.values,
    raw: result.answer.data,
    block: result.block,
    at,
    sources,
    check: result.check,
    ...withGap,
  };
}
