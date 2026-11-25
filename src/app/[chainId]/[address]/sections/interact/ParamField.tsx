"use client";

import { useId, useState } from "react";
import { IoAdd, IoClipboardOutline, IoCodeSlash, IoTrashOutline } from "react-icons/io5";
import {
  AbiParam,
  FormValue,
  arrayOf,
  displayType,
  elementParam,
  emptyValue,
  fromJson,
  parseJsonExact,
  groupDigits,
  leafError,
  scaleDecimal,
  toJson,
  userTypeName,
} from "@/utils/interact/abi";
import { NatSpecNote } from "./FunctionRow";
import { useWallet } from "./Wallet";
import { buttonQuiet, buttonSmall, inputBorder, inputClass, selectClass, textareaClass } from "./ui";

interface FieldProps {
  param: AbiParam;
  value: FormValue;
  onChange: (value: FormValue) => void;
  /** NatSpec @param text */
  doc?: string;
  /** Shown if the parameter has no name, e.g. "input 0" or "item 2" */
  fallbackName?: string;
  depth?: number;
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm leading-5 text-red-700">
      {message}
    </p>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm leading-5 text-gray-500">{children}</p>;
}

/**
 * A label, its control and the @param note of the input. The label sits above the control, and the note
 * sits under it, so both have the full width.
 */
export function Field({
  htmlFor,
  name,
  type,
  doc,
  children,
}: {
  htmlFor?: string;
  name: string;
  type: string;
  doc?: string;
  children: React.ReactNode;
}) {
  const label = (
    <label htmlFor={htmlFor} className="break-words text-sm leading-5 text-gray-800">
      <span className="font-medium">{name}</span>
      <span className="ml-1.5 inline-block whitespace-nowrap font-mono text-xs text-gray-500">{type}</span>
    </label>
  );
  const note = doc ? <NatSpecNote kind="param" text={doc} className="mt-1" /> : null;
  return (
    <div className="min-w-0">
      <div className="mb-1 min-w-0">{label}</div>
      {children}
      {note}
    </div>
  );
}

/* --------------------------------------------------------------- integers */

/** Units for an amount, with the Ethereum unit name first. 10^8 (tokens with 8 decimals, e.g. WBTC) has no unit name. */
const UNITS = [
  { exp: 0, label: "wei ×1" },
  { exp: 6, label: "mwei ×10^6" },
  { exp: 8, label: "×10^8" },
  { exp: 9, label: "gwei ×10^9" },
  { exp: 18, label: "ether ×10^18" },
];

function IntegerInput({ param, value, onChange, id, errorId }: FieldProps & { id: string; errorId: string }) {
  const stored = typeof value === "string" ? value : "";
  const [text, setText] = useState(stored);
  const [exp, setExp] = useState(0);
  const scaled = (input: string, unit: number) => (unit === 0 ? input : (scaleDecimal(input, unit) ?? input));

  // The value came from outside (reset, pasted JSON): show it as it is
  if (stored !== scaled(text, exp)) {
    setText(stored);
    setExp(0);
  }

  const bits = Number(/\d+$/.exec(param.type)?.[0] ?? 256);
  const isEnum = userTypeName(param)?.kind === "enum";
  // With a unit (×10^n), more than n decimal places cannot become a whole number
  const tooPrecise = exp > 0 && /^-?\d*\.\d+$/.test(text.trim()) && scaleDecimal(text, exp) === null;
  const error = tooPrecise ? `With ×10^${exp}, enter at most ${exp} decimal places.` : leafError(param.type, stored);
  // Amounts get a "Max" helper, as on Blockscout (approvals often use the largest value)
  const canMax = !isEnum && !param.type.startsWith("int") && bits >= 128 && text === "";
  const hasUnits = !isEnum && bits >= 64;
  const looksDecimal = exp === 0 && /^-?\d*\.\d*$/.test(text.trim()) && text.trim() !== ".";

  return (
    <>
      <div className="flex gap-2">
        <span className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode={isEnum ? "numeric" : "decimal"}
            autoComplete="off"
            spellCheck={false}
            value={text}
            placeholder={isEnum ? "0" : exp > 0 ? "1.5" : "0"}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setText(e.target.value);
              onChange(scaled(e.target.value, exp));
            }}
            className={`${inputClass} ${inputBorder(!!error)} ${canMax ? "pr-12" : ""}`}
          />
          {canMax && (
            <button
              type="button"
              className="absolute right-1 top-1 h-6 cursor-pointer rounded px-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
              data-tooltip-id="global-tooltip"
              data-tooltip-content={`The largest ${param.type}: 2^${bits} − 1`}
              onClick={() => {
                const max = (BigInt(2) ** BigInt(bits) - BigInt(1)).toString();
                setText(max);
                setExp(0);
                onChange(max);
              }}
            >
              Max
            </button>
          )}
        </span>
        {/* Small types (uint8, uint24, …) are not amounts: no unit helper */}
        {hasUnits && (
          <select
            aria-label={`Unit for ${param.name || "this number"}`}
            value={exp}
            onChange={(e) => {
              const unit = Number(e.target.value);
              setExp(unit);
              onChange(scaled(text, unit));
            }}
            className={`${selectClass} w-[7.5rem]`}
          >
            {UNITS.map((unit) => (
              <option key={unit.exp} value={unit.exp}>
                {unit.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <FieldError id={errorId} message={error} />
      {looksDecimal && <Hint>To enter a decimal amount, choose a unit on the right, for example ×10^18.</Hint>}
      {!error && exp > 0 && stored !== "" && (
        <Hint>
          Sent value ({param.type}): <span className="font-mono break-all">{groupDigits(stored)}</span>
        </Hint>
      )}
      {isEnum && <Hint>Enum {userTypeName(param)!.name}: enter the number of the option. The first option is 0.</Hint>}
    </>
  );
}

/* ------------------------------------------------------------ single value */

function LeafField({ param, value, onChange, doc, fallbackName }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const { connection } = useWallet();
  const name = param.name || fallbackName || "value";
  const text = typeof value === "string" ? value : "";
  const error = leafError(param.type, value);
  const describedBy = error ? errorId : undefined;

  if (param.type === "bool") {
    const checked = value === true;
    return (
      <Field name={name} type="bool" doc={doc}>
        <div className="flex h-8 items-center">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={name}
            onClick={() => onChange(!checked)}
            className="inline-flex cursor-pointer items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500 focus-visible:ring-offset-2"
          >
            <span
              className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-cerulean-blue-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`}
              />
            </span>
            <span className="font-mono text-[13px] text-gray-900">{checked ? "true" : "false"}</span>
          </button>
        </div>
      </Field>
    );
  }

  if (/^u?int\d*$/.test(param.type)) {
    return (
      <Field htmlFor={id} name={name} type={displayTypeWithBase(param)} doc={doc}>
        <IntegerInput param={param} value={value} onChange={onChange} id={id} errorId={errorId} />
      </Field>
    );
  }

  if (param.type === "address") {
    return (
      <Field htmlFor={id} name={name} type={displayTypeWithBase(param)} doc={doc}>
        <div className="relative">
          <input
            id={id}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={text}
            placeholder="0x…"
            aria-invalid={!!error}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value.trim())}
            className={`${inputClass} ${inputBorder(!!error)} pr-16`}
          />
          {/* Helpers inside the field, as Blockscout and Tenderly have them */}
          <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
            {connection && text === "" && (
              <button
                type="button"
                className="h-6 cursor-pointer rounded px-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
                data-tooltip-id="global-tooltip"
                data-tooltip-content="Use the address of your connected wallet"
                onClick={() => onChange(connection.account)}
              >
                Self
              </button>
            )}
            <button
              type="button"
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
              aria-label={`Paste into ${name}`}
              data-tooltip-id="global-tooltip"
              data-tooltip-content="Paste from the clipboard"
              onClick={async () => {
                try {
                  onChange((await navigator.clipboard.readText()).trim());
                } catch {
                  // The browser did not allow it: the user can paste with the keyboard
                }
              }}
            >
              <IoClipboardOutline className="h-4 w-4" />
            </button>
          </span>
        </div>
        <FieldError id={errorId} message={error} />
      </Field>
    );
  }

  if (param.type === "string" || param.type === "bytes") {
    const isBytes = param.type === "bytes";
    const byteCount = isBytes && !error && text.startsWith("0x") ? (text.length - 2) / 2 : null;
    return (
      <Field htmlFor={id} name={name} type={param.type} doc={doc}>
        <textarea
          id={id}
          rows={text.length > 60 ? 3 : 1}
          spellCheck={false}
          value={text}
          placeholder={isBytes ? "0x…" : "text"}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => onChange(isBytes ? e.target.value.trim() : e.target.value)}
          className={`${textareaClass} ${inputBorder(!!error)} block min-h-8 resize-y break-all`}
        />
        <FieldError id={errorId} message={error} />
        {byteCount !== null && (
          <Hint>
            {byteCount} {byteCount === 1 ? "byte" : "bytes"}
          </Hint>
        )}
      </Field>
    );
  }

  // bytesN and any other type
  const fixedBytes = /^bytes(\d+)$/.exec(param.type);
  return (
    <Field htmlFor={id} name={name} type={param.type} doc={doc}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={fixedBytes ? `0x + ${Number(fixedBytes[1]) * 2} hex characters` : ""}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value.trim())}
        className={`${inputClass} ${inputBorder(!!error)}`}
      />
      <FieldError id={errorId} message={error} />
    </Field>
  );
}

/** `ItemType (uint8)` for an enum, `IERC20 (address)` for a contract type, else the plain type. */
function displayTypeWithBase(param: AbiParam): string {
  const user = userTypeName(param);
  if (user && (user.kind === "enum" || user.kind === "contract")) return `${user.name} (${param.type})`;
  return param.type;
}

/* ------------------------------------------------------------ paste as JSON */

function JsonPaste({ param, value, onChange, onClose }: FieldProps & { onClose: () => void }) {
  const id = useId();
  const [text, setText] = useState(() => JSON.stringify(toJson(param, value), null, 2));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    try {
      onChange(fromJson(param, parseJsonExact(text)));
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(caught instanceof SyntaxError ? `This is not valid JSON: ${message}` : message);
    }
  };

  return (
    <div className="mb-3 rounded-md border border-cerulean-blue-200 bg-cerulean-blue-100/40 p-2.5">
      <label htmlFor={id} className="mb-1 block text-sm text-gray-700">
        Edit or paste the whole value as JSON. Numbers can be text, to keep large values exact.
      </label>
      <textarea
        id={id}
        rows={8}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        aria-invalid={!!error}
        className={`${textareaClass} ${inputBorder(!!error)} block resize-y`}
      />
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className={buttonSmall} onClick={apply}>
          Fill the form from JSON
        </button>
        <button type="button" className={buttonQuiet} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- tuples and arrays */

const groupClass = (depth: number) =>
  `min-w-0 rounded-md border border-gray-200 px-3 pb-3 pt-1 ${depth % 2 === 0 ? "bg-gray-50" : "bg-white"}`;

function GroupLegend({
  name,
  type,
  detail,
  jsonOpen,
  onToggleJson,
}: {
  name: string;
  type: string;
  detail?: string;
  jsonOpen: boolean;
  onToggleJson: () => void;
}) {
  return (
    <legend className="flex max-w-full flex-nowrap items-center gap-x-2 px-1 text-sm leading-6">
      <span className="shrink-0 font-medium text-gray-800">{name}</span>
      <span className="min-w-0 truncate font-mono text-xs text-gray-500">{type}</span>
      {detail && <span className="hidden shrink-0 whitespace-nowrap text-xs text-gray-500 sm:inline">{detail}</span>}
      <button type="button" className={buttonQuiet} aria-expanded={jsonOpen} onClick={onToggleJson}>
        <IoCodeSlash className="h-3.5 w-3.5" />
        JSON
      </button>
    </legend>
  );
}

/** One input of a function: a single field, a struct (group of fields), or a list with add and remove. */
export default function ParamField(props: FieldProps) {
  const { param, value, onChange, doc, fallbackName, depth = 0 } = props;
  const [jsonOpen, setJsonOpen] = useState(false);
  const name = param.name || fallbackName || "value";
  const array = arrayOf(param.type);

  if (array) {
    const items = Array.isArray(value) ? value : [];
    const element = elementParam(param);
    const isSimple = !arrayOf(element.type) && element.type !== "tuple";
    const setItem = (index: number, next: FormValue) => onChange(items.map((item, i) => (i === index ? next : item)));
    return (
      <fieldset className={groupClass(depth)}>
        <GroupLegend
          name={name}
          type={displayType(param)}
          detail={
            array.length !== null
              ? `fixed list of ${array.length}`
              : `${items.length} ${items.length === 1 ? "item" : "items"}`
          }
          jsonOpen={jsonOpen}
          onToggleJson={() => setJsonOpen((open) => !open)}
        />
        {doc && <NatSpecNote kind="param" text={doc} className="mb-3" />}
        {jsonOpen && <JsonPaste {...props} onClose={() => setJsonOpen(false)} />}
        {items.length === 0 && <p className="mb-2 text-sm text-gray-500">The list is empty. That is a valid value.</p>}
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li key={index} className={isSimple ? "flex items-start gap-2" : "relative"}>
              <div className="min-w-0 flex-1">
                <ParamField
                  param={element}
                  value={item}
                  onChange={(next) => setItem(index, next)}
                  fallbackName={`${name}[${index}]`}
                  depth={depth + 1}
                />
              </div>
              {array.length === null && (
                <button
                  type="button"
                  aria-label={`Remove ${name}[${index}]`}
                  data-tooltip-id="global-tooltip"
                  data-tooltip-content="Remove this item"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  className={
                    isSimple
                      ? `mt-[26px] shrink-0 cursor-pointer rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500`
                      : "absolute right-1.5 top-0 cursor-pointer rounded bg-inherit p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500"
                  }
                >
                  <IoTrashOutline className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
        {array.length === null && (
          <button
            type="button"
            className={`${buttonSmall} mt-2`}
            onClick={() => onChange([...items, emptyValue(element)])}
          >
            <IoAdd className="h-3.5 w-3.5" />
            Add item
          </button>
        )}
      </fieldset>
    );
  }

  if (param.type === "tuple") {
    const components = param.components ?? [];
    const fields = Array.isArray(value) ? value : [];
    return (
      <fieldset className={groupClass(depth)}>
        <GroupLegend
          name={name}
          type={displayType(param)}
          detail={`struct, ${components.length} fields`}
          jsonOpen={jsonOpen}
          onToggleJson={() => setJsonOpen((open) => !open)}
        />
        {doc && <NatSpecNote kind="param" text={doc} className="mb-3" />}
        {jsonOpen && <JsonPaste {...props} onClose={() => setJsonOpen(false)} />}
        <div className="space-y-5">
          {components.map((component, index) => (
            <ParamField
              key={index}
              param={component}
              value={fields[index] ?? emptyValue(component)}
              onChange={(next) =>
                onChange(components.map((other, i) => (i === index ? next : (fields[i] ?? emptyValue(other)))))
              }
              fallbackName={`field ${index}`}
              depth={depth + 1}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  return <LeafField {...props} />;
}
