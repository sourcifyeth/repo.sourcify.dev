"use client";

import { useEffect, useId, useState } from "react";
import {
  type AbiParam,
  type Fn,
  type FormValue,
  arrayOf,
  emptyValue,
  groupDigits,
  leafError,
} from "@/utils/interact/abi";
import {
  type LinkedItem,
  type LinkedModel,
  type Presentation,
  tokenAddressOf,
  valueAt,
  withValueAt,
} from "@/utils/interact/clearSigning/link";
import {
  DURATION_UNITS,
  amountToRaw,
  dateToRaw,
  durationToRaw,
  enumIndex,
  enumOptions,
  invalidRaw,
  invalidText,
  isWholeNumber,
  maxOfType,
  rawToAmount,
  rawToDate,
  rawToDuration,
  reachesThreshold,
} from "@/utils/interact/clearSigning/parsers";
import { REGISTRY_DISCLAIMER_URL, type ModelSource } from "@/utils/interact/clearSigning/registry";
import type { PathStep } from "@/utils/interact/clearSigning/signature";
import { type TokenInfo, readTokenInfo } from "@/utils/interact/clearSigning/token";
import type { CallContext } from "@/utils/interact/types";
import { useSources } from "./DataSources";
import ParamField, {
  Field,
  FieldError,
  type FieldProps,
  Hint,
  LeafField,
  decimalOf,
  displayTypeWithBase,
} from "./ParamField";
import { buttonSmall, inputBorder, inputClass, selectClass } from "./ui";

/* ------------------------------------------------------------------ tokens */

export type TokenState =
  /** The page does not know which token it is (for example, the token is another input that is still empty) */
  { status: "unknown" } | { status: "loading" } | ({ status: "ready" } & TokenInfo) | { status: "failed" };

/**
 * The decimals and symbol of the token of an amount field. `token` is an address, "native" for the chain's own
 * currency, or null. The read starts only when a field with this token is on the page, i.e. in an opened function.
 */
export function useTokenInfo(chainId: string, token: string | "native" | null): TokenState {
  const sources = useSources();
  const urls = sources.selected.map((endpoint) => endpoint.url);
  const key = token && token !== "native" && urls.length > 0 ? `${token} ${urls.join(" ")}` : null;
  const [read, setRead] = useState<{ key: string; info: TokenInfo | null } | null>(null);

  useEffect(() => {
    if (!key || !token) return;
    let cancelled = false;
    readTokenInfo(chainId, token, urls).then(
      (info) => !cancelled && setRead({ key, info }),
      () => !cancelled && setRead({ key, info: null })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` holds the token and the endpoints
  }, [chainId, key]);

  if (token === null) return { status: "unknown" };
  if (token === "native") {
    if (sources.status === "loading") return { status: "loading" };
    const currency = sources.chain?.nativeCurrency;
    return { status: "ready", decimals: currency?.decimals ?? 18, symbol: currency?.symbol ?? "ETH" };
  }
  if (!key) return sources.status === "loading" ? { status: "loading" } : { status: "failed" };
  if (read?.key !== key) return { status: "loading" };
  return read.info ? { status: "ready", ...read.info } : { status: "failed" };
}

/* ------------------------------------------------- text that stands for raw */

/**
 * The text of a control whose value is stored in another form (the raw value of the ABI): "1.5" for 1500000.
 * `fromRaw` gives the text for a stored value, `toRaw` the stored value for a text. A stored value that
 * changes from outside (Reset, the other form, a button) replaces the text.
 */
function useRawText(
  raw: string,
  onChange: (raw: string) => void,
  toRaw: (text: string) => string,
  fromRaw: (raw: string) => string
): [string, (text: string) => void] {
  const [text, setText] = useState(() => fromRaw(raw));
  // The stored value that `text` stands for
  const [synced, setSynced] = useState(raw);
  if (raw !== synced) {
    setSynced(raw);
    setText(fromRaw(raw));
  }
  const edit = (next: string) => {
    const value = toRaw(next);
    setText(next);
    setSynced(value);
    onChange(value);
  };
  // A value typed in the other form can be text that means another raw value here ("1.5", hex): store that value
  useEffect(() => {
    const value = toRaw(text);
    if (value !== raw) {
      setSynced(value);
      onChange(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the control appears
  }, []);
  return [text, edit];
}

/** A stored integer in decimal digits (hex text becomes decimal); an empty value stays empty. */
const plain = (raw: string) => (raw.trim() === "" ? "" : decimalOf(raw));

/** The text of a stored integer with `decimals` places; text that is not an integer stays as it is. */
function amountText(raw: string, decimals: number): string {
  const normal = plain(raw);
  return isWholeNumber(normal) ? rawToAmount(normal, decimals) : (invalidText(raw) ?? raw);
}

const amountRaw = (text: string, decimals: number) =>
  text.trim() === "" ? "" : (amountToRaw(text, decimals) ?? invalidRaw(text.trim()));

/* ------------------------------------------------------------------ fields */

interface DescribedProps extends FieldProps {
  presentation: Presentation;
  /** The token of a `tokenAmount` field with the current values (see tokenAddressOf) */
  token: string | "native" | null;
  /** The label of the input that holds the token's address, if the token is another input */
  tokenInput?: string;
  chainId: string;
}

const isInteger = (type: string) => /^u?int\d*$/.test(type);

/** The name in the verified ABI, if the descriptor gave the input another label. */
function paramNameOf(param: AbiParam, presentation: Presentation): string | undefined {
  return presentation.described && param.name && param.name !== presentation.label ? param.name : undefined;
}

function SentValue({ param, raw }: { param: AbiParam; raw: string }) {
  return (
    <Hint>
      Sent value ({param.type}): <span className="break-all font-mono">{groupDigits(decimalOf(raw))}</span>
    </Hint>
  );
}

/**
 * A number with decimal places: a token amount, a native amount, or a `unit` value such as a percentage.
 * The person types "1.5"; the form stores the integer.
 */
function DecimalField({
  param,
  value,
  onChange,
  doc,
  presentation,
  decimals,
  suffix,
  suffixHelp,
}: FieldProps & { presentation: Presentation; decimals: number; suffix: string; suffixHelp?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  const raw = typeof value === "string" ? value : "";
  const [text, edit] = useRawText(
    raw,
    onChange,
    (next) => amountRaw(next, decimals),
    (stored) => amountText(stored, decimals)
  );
  const top = maxOfType(param.type);
  // "Unlimited", "All": at or above the descriptor's threshold a wallet shows this word, not the number
  const limitWord =
    presentation.threshold !== undefined && top && reachesThreshold(top, presentation.threshold)
      ? presentation.message || "Unlimited"
      : null;
  const atLimit = limitWord !== null && reachesThreshold(plain(raw), presentation.threshold);
  const unparsed = raw !== "" && invalidText(raw) !== null;
  const error = unparsed
    ? decimals === 0
      ? "Enter a whole number."
      : `Enter a number with at most ${decimals} decimal places.`
    : leafError(param.type, raw);

  return (
    <Field
      htmlFor={id}
      name={presentation.label}
      paramName={paramNameOf(param, presentation)}
      type={displayTypeWithBase(param)}
      typeInInput
      doc={doc}
    >
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            // At the limit the field shows the word that a wallet shows; "Clear" brings the number field back
            value={atLimit ? limitWord : text}
            readOnly={atLimit}
            placeholder={displayTypeWithBase(param)}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => edit(e.target.value)}
            className={`${inputClass} ${inputBorder(!!error)} ${suffix ? "pr-20" : ""} ${atLimit ? "bg-gray-50 font-sans" : ""}`}
          />
          {suffix && (
            <span
              className="pointer-events-auto absolute inset-y-0 right-2.5 flex max-w-[45%] items-center truncate text-xs text-gray-500"
              data-tooltip-id={suffixHelp ? "global-tooltip" : undefined}
              data-tooltip-content={suffixHelp}
            >
              {suffix}
            </span>
          )}
        </span>
        {limitWord && (
          <button
            type="button"
            className={`${buttonSmall} h-8`}
            data-tooltip-id="global-tooltip"
            data-tooltip-content={
              atLimit
                ? "Enter a number instead"
                : `Sets the largest ${param.type}. A wallet shows it as “${limitWord}”.`
            }
            onClick={() => onChange(atLimit ? "" : top!)}
          >
            {atLimit ? "Clear" : limitWord}
          </button>
        )}
      </div>
      <FieldError id={errorId} message={error} />
      {!error && raw !== "" && <SentValue param={param} raw={raw} />}
    </Field>
  );
}

/** A token amount. Until the page knows the token's decimals, the field takes the raw integer, as in the ABI form. */
function AmountField(props: DescribedProps) {
  const { presentation, param, chainId } = props;
  const info = useTokenInfo(chainId, presentation.format === "amount" ? "native" : props.token);
  if (info.status === "ready") {
    return (
      <DecimalField
        // Other decimals mean another text for the same stored integer
        key={info.decimals}
        {...props}
        decimals={info.decimals}
        suffix={info.symbol}
        suffixHelp={`${info.symbol || "This token"} has ${info.decimals} decimals`}
      />
    );
  }
  return (
    <div className="min-w-0">
      <LeafField {...props} label={presentation.label} paramName={paramNameOf(param, presentation)} />
      <Hint>
        {info.status === "loading"
          ? "Reading the decimals of the token…"
          : info.status === "failed"
            ? "The decimals of the token could not be read. Enter the raw amount, or choose a unit."
            : presentation.token
              ? `Fill ${props.tokenInput ? `“${props.tokenInput}”` : "the token address"} first. Then this field takes a decimal amount.`
              : "Enter the raw amount, or choose a unit."}
      </Hint>
    </div>
  );
}

/** A date and time in UTC, stored as a Unix timestamp in seconds. */
function DateField({ param, value, onChange, doc, presentation }: DescribedProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const raw = typeof value === "string" ? value : "";
  const [text, edit] = useRawText(
    raw,
    onChange,
    (next) => (next.trim() === "" ? "" : (dateToRaw(next) ?? invalidRaw(next.trim()))),
    (stored) => rawToDate(plain(stored)) ?? invalidText(stored) ?? ""
  );
  const error = raw !== "" && invalidText(raw) !== null ? "Enter a date and a time." : leafError(param.type, raw);
  return (
    <Field
      htmlFor={id}
      name={presentation.label}
      paramName={paramNameOf(param, presentation)}
      type={`${displayTypeWithBase(param)} · date and time in UTC`}
      doc={doc}
    >
      <input
        id={id}
        type="datetime-local"
        step={1}
        value={text}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => edit(e.target.value)}
        className={`${inputClass} ${inputBorder(!!error)} max-w-xs`}
      />
      <FieldError id={errorId} message={error} />
      {!error && raw !== "" && <SentValue param={param} raw={raw} />}
    </Field>
  );
}

/** A length of time, stored in seconds. */
function DurationField({ param, value, onChange, doc, presentation }: DescribedProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const raw = typeof value === "string" ? value : "";
  const shown = (stored: string) => {
    const normal = plain(stored);
    return isWholeNumber(normal) ? rawToDuration(normal) : { text: invalidText(stored) ?? stored, unitSeconds: 1 };
  };
  const [unitSeconds, setUnitSeconds] = useState(() => shown(raw).unitSeconds);
  const toRaw = (next: string, unit: number) =>
    next.trim() === "" ? "" : (durationToRaw(next, unit) ?? invalidRaw(next.trim()));
  const [text, setText] = useState(() => shown(raw).text);
  const [synced, setSynced] = useState(raw);
  if (raw !== synced) {
    setSynced(raw);
    setText(shown(raw).text);
    setUnitSeconds(shown(raw).unitSeconds);
  }
  const edit = (next: string, unit: number) => {
    const stored = toRaw(next, unit);
    setText(next);
    setUnitSeconds(unit);
    setSynced(stored);
    onChange(stored);
  };
  const error =
    raw !== "" && invalidText(raw) !== null ? "Enter a number that gives whole seconds." : leafError(param.type, raw);
  return (
    <Field
      htmlFor={id}
      name={presentation.label}
      paramName={paramNameOf(param, presentation)}
      type={displayTypeWithBase(param)}
      typeInInput
      doc={doc}
    >
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder={displayTypeWithBase(param)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => edit(e.target.value, unitSeconds)}
          className={`${inputClass} ${inputBorder(!!error)}`}
        />
        <select
          aria-label={`Unit of ${presentation.label}`}
          value={unitSeconds}
          onChange={(e) => edit(text, Number(e.target.value))}
          className={`${selectClass} w-[6.5rem]`}
        >
          {DURATION_UNITS.map((unit) => (
            <option key={unit.seconds} value={unit.seconds}>
              {unit.label}
            </option>
          ))}
        </select>
      </div>
      <FieldError id={errorId} message={error} />
      {!error && raw !== "" && unitSeconds !== 1 && <SentValue param={param} raw={raw} />}
    </Field>
  );
}

/** One of the named values of the descriptor. */
function EnumField({ param, value, onChange, doc, presentation }: DescribedProps) {
  const id = useId();
  const options = enumOptions(presentation.options ?? {}, param.type);
  const stored = typeof value === "boolean" ? value : typeof value === "string" ? value : "";
  const index = enumIndex(options, stored);
  // A value from the other form that has no name stays in the list, so that the select does not change it
  const other = index < 0 && typeof stored === "string" && stored.trim() !== "" ? stored : null;
  const error = typeof stored === "string" ? leafError(param.type, stored) : null;
  return (
    <Field
      htmlFor={id}
      name={presentation.label}
      paramName={paramNameOf(param, presentation)}
      type={displayTypeWithBase(param)}
      doc={doc}
    >
      <select
        id={id}
        value={other !== null ? "other" : index}
        aria-invalid={!!error}
        onChange={(e) => {
          const choice = options[Number(e.target.value)];
          if (choice) onChange(choice.value);
          else if (e.target.value === "-1") onChange("");
        }}
        className={`${selectClass} h-8 w-full max-w-md text-sm`}
      >
        {param.type !== "bool" && <option value={-1}>Choose…</option>}
        {options.map((option, i) => (
          <option key={i} value={i}>
            {option.label} ({String(option.value)})
          </option>
        ))}
        {other !== null && <option value="other">{other} (no name in the descriptor)</option>}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </Field>
  );
}

/**
 * One value with the label and the input control of its descriptor field. A format that the page has no
 * control for, or that does not fit the type, gets the normal field of the type with the descriptor's label.
 */
export function DescribedField(props: DescribedProps) {
  const { presentation, param } = props;
  const { format } = presentation;
  const integer = isInteger(param.type);
  if ((format === "tokenAmount" || format === "amount") && integer) return <AmountField {...props} />;
  if (format === "unit" && integer && presentation.decimals !== undefined)
    return <DecimalField {...props} decimals={presentation.decimals} suffix={presentation.base ?? ""} />;
  if (format === "date" && integer && presentation.encoding !== "blockheight") {
    const raw = typeof props.value === "string" ? props.value : "";
    // A stored number that is not a date (too large) keeps its number field: a date field could not show it
    if (raw === "" || invalidText(raw) !== null || rawToDate(plain(raw)) !== null) return <DateField {...props} />;
  }
  if (format === "duration" && integer) return <DurationField {...props} />;
  if (format === "enum" && presentation.options && (integer || param.type === "bool")) return <EnumField {...props} />;
  return <LeafField {...props} label={presentation.label} paramName={paramNameOf(param, presentation)} />;
}

/* -------------------------------------------------------------------- form */

interface DescriptorFormProps {
  link: LinkedModel;
  source: ModelSource;
  fn: Fn;
  ctx: CallContext;
  values: FormValue[];
  setValues: (update: (current: FormValue[]) => FormValue[]) => void;
  /** The field for the native value of a payable function, with the given label */
  /** The native value field. Without a label it says "Send native ETH" (with the chain's currency). */
  valueField: (label?: string) => React.ReactNode;
}

const SOURCE_TEXT: Record<ModelSource, string> = {
  registry: "the ERC-7730 registry",
  erc20: "the generic ERC-20 template",
  erc721: "the generic ERC-721 template",
};

/**
 * The inputs of a function as its ERC-7730 descriptor shows them: the descriptor's labels and order, and for each
 * display format a control that takes what a person reads ("1.5 USDT", a date). The values are the same values
 * as in the ABI form (see utils/interact/clearSigning/link.ts), so the two forms can be switched at any time.
 */
export default function DescriptorForm({ link, source, fn, ctx, values, setValues, valueField }: DescriptorFormProps) {
  // The label of the input at (or around) the steps: for "fill the token first"
  const inputs = link.items.flatMap((entry) => (entry.kind === "group" ? entry.items : [entry]));
  const labelAt = (steps: PathStep[]): string | undefined => {
    for (const entry of inputs) {
      if (entry.kind === "input" && entry.steps.every((step, i) => steps[i] === step)) return entry.presentation.label;
    }
    return undefined;
  };

  const item = (entry: LinkedItem, key: string): React.ReactNode => {
    if (entry.kind === "group") {
      return (
        <div key={key} className="flex min-w-0 flex-col gap-5">
          {entry.label && <p className="-mb-2 text-sm font-medium text-gray-800">{entry.label}</p>}
          {entry.items.map((inner, i) => item(inner, `${key}-${i}`))}
        </div>
      );
    }
    if (entry.kind === "constant") {
      return (
        <div key={key} className="min-w-0 text-sm leading-5">
          <p className="font-medium text-gray-800">{entry.label}</p>
          <p className="break-words text-gray-700">{entry.value}</p>
        </div>
      );
    }
    if (entry.kind === "value") return <div key={key}>{valueField(entry.presentation.label)}</div>;

    const { steps, param, presentation, overlay } = entry;
    const value = valueAt(values, steps) ?? emptyValue(param);
    const onChange = (next: FormValue) => setValues((current) => withValueAt(current, steps, next));
    // NatSpec @param notes belong to the arguments of the function, not to the fields of a struct
    const doc = steps.length === 1 ? fn.paramDocs[fn.inputs[steps[0]].name] : undefined;
    const described = (leaf: Presentation, props: FieldProps) => (
      <DescribedField
        {...props}
        presentation={leaf}
        token={tokenAddressOf(leaf, values, ctx.address)}
        tokenInput={leaf.token && "steps" in leaf.token ? labelAt(leaf.token.steps) : undefined}
        chainId={ctx.chainId}
      />
    );
    if (arrayOf(param.type) || param.type === "tuple") {
      return (
        <ParamField
          key={key}
          param={param}
          value={value}
          onChange={onChange}
          doc={doc}
          label={presentation.described ? presentation.label : undefined}
          fallbackName={presentation.label}
          renderLeaf={
            overlay
              ? (at, props) => {
                  const leaf = overlay.get(at);
                  return leaf ? described(leaf, props) : undefined;
                }
              : undefined
          }
        />
      );
    }
    return <div key={key}>{described(presentation, { param, value, onChange, doc })}</div>;
  };

  return (
    <>
      {link.items.map((entry, i) => item(entry, String(i)))}
      {fn.mutability === "payable" && !link.hasValue && valueField()}
      <p className="-mt-2 text-xs leading-[18px] text-gray-500">
        Labels come from {SOURCE_TEXT[source]}. They are not attested.{" "}
        <a
          href={REGISTRY_DISCLAIMER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap underline hover:text-gray-700"
        >
          Learn more
        </a>
      </p>
    </>
  );
}
