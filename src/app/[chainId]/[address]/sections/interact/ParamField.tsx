"use client";

import { useId, useState } from "react";
import { IoAdd, IoChevronForward, IoClipboardOutline, IoCodeSlash, IoTrashOutline } from "react-icons/io5";
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
  scaledInput,
  unitProblem,
  toJson,
  userTypeName,
} from "@/utils/interact/abi";
import { NatSpecNote } from "./FunctionRow";
import { useWallet } from "./Wallet";
import { buttonQuiet, buttonSmall, inputBorder, inputClass, selectClass, textareaClass } from "./ui";

export interface FieldProps {
  param: AbiParam;
  value: FormValue;
  onChange: (value: FormValue) => void;
  /** NatSpec @param text */
  doc?: string;
  /** Shown if the parameter has no name, e.g. "input 0" or "item 2" */
  fallbackName?: string;
  depth?: number;
  /** Shown in place of the parameter's name: the label of a clear signing descriptor */
  label?: string;
  /** The name in the verified ABI, shown next to a descriptor's label when the two differ */
  paramName?: string;
  /** For a struct or a list: a control at the end of its title bar (the "remove this item" button of a list) */
  groupAction?: React.ReactNode;
  /**
   * For a clear signing form: draws a single value inside this struct or list in another way (see DescriptorForm).
   * `at` says where the value is, from the input that got this prop: "[].1" is field 1 of each list element.
   * If it returns undefined, the value gets its normal field.
   */
  renderLeaf?: (at: string, props: FieldProps) => React.ReactNode | undefined;
  at?: string;
}

export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm leading-5 text-red-700">
      {message}
    </p>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm leading-5 text-gray-500">{children}</p>;
}

/**
 * A label, its control and the @param note of the input. The label sits above the control, with the small
 * grey detail next to it (the name in the verified ABI if it differs, "payable"). The note sits under the
 * control. The open function has one width for all of its content (42rem, see FunctionPanel), so a control and
 * its note are as wide as the struct bars and the result.
 * A text control shows the type as its placeholder (`typeInInput`); for other controls (a switch, a select,
 * a date) the type is part of the detail.
 */
export function Field({
  htmlFor,
  name,
  paramName,
  type,
  typeInInput = false,
  doc,
  children,
}: {
  htmlFor?: string;
  name: string;
  /** The name in the verified ABI, if it differs from `name` */
  paramName?: string;
  type: string;
  /** True if the control shows the type as its placeholder */
  typeInInput?: boolean;
  doc?: string;
  children: React.ReactNode;
}) {
  const detail = [paramName, typeInInput ? null : type].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 break-words text-sm leading-5 text-gray-800"
      >
        <span className="font-medium">{name}</span>
        {detail && <span className="font-mono text-xs text-gray-500">{detail}</span>}
      </label>
      <div className="min-w-0">{children}</div>
      {doc && <NatSpecNote kind="param" text={doc} className="mt-1" />}
    </div>
  );
}

/* --------------------------------------------------------------- integers */

/** An integer as decimal text: hex text (0x10) becomes 16. Text that is not a number stays as it is. */
export function decimalOf(text: string): string {
  const trimmed = text.trim();
  const negative = trimmed.startsWith("-");
  try {
    const value = BigInt(negative ? trimmed.slice(1) : trimmed);
    return `${negative && value !== BigInt(0) ? "-" : ""}${value.toString()}`;
  } catch {
    return trimmed;
  }
}

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
  // With a unit, the field takes a decimal number only (see scaledInput)
  const scaled = scaledInput;

  // The value came from outside (reset, pasted JSON): show it as it is
  if (stored !== scaled(text, exp)) {
    setText(stored);
    setExp(0);
  }

  const bits = Number(/\d+$/.exec(param.type)?.[0] ?? 256);
  const isEnum = userTypeName(param)?.kind === "enum";
  // With a unit (×10^n), more than n decimal places cannot become a whole number
  const error = unitProblem(text, exp) ?? leafError(param.type, stored);
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
            placeholder={displayTypeWithBase(param)}
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
      {!error && stored !== "" && (exp > 0 || /^-?0x/i.test(stored.trim())) && (
        // Always in decimal: also for hex text (wei ×1), so the user sees the number that is sent
        <Hint>
          Sent value ({param.type}): <span className="font-mono break-all">{groupDigits(decimalOf(stored))}</span>
        </Hint>
      )}
      {isEnum && <Hint>Enum {userTypeName(param)!.name}: enter the number of the option. The first option is 0.</Hint>}
    </>
  );
}

/* ------------------------------------------------------------ single value */

export function LeafField({ param, value, onChange, doc, fallbackName, label, paramName }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const { connection } = useWallet();
  const name = label || param.name || fallbackName || "value";
  const text = typeof value === "string" ? value : "";
  const error = leafError(param.type, value);
  const describedBy = error ? errorId : undefined;

  if (param.type === "bool") {
    const checked = value === true;
    return (
      <Field name={name} paramName={paramName} type="bool" doc={doc}>
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
      <Field htmlFor={id} name={name} paramName={paramName} type={displayTypeWithBase(param)} typeInInput doc={doc}>
        <IntegerInput param={param} value={value} onChange={onChange} id={id} errorId={errorId} />
      </Field>
    );
  }

  if (param.type === "address") {
    return (
      <Field htmlFor={id} name={name} paramName={paramName} type={displayTypeWithBase(param)} typeInInput doc={doc}>
        <div className="relative">
          <input
            id={id}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={text}
            placeholder={displayTypeWithBase(param)}
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
      <Field htmlFor={id} name={name} paramName={paramName} type={param.type} typeInInput doc={doc}>
        <textarea
          id={id}
          rows={text.length > 60 ? 3 : 1}
          spellCheck={false}
          value={text}
          placeholder={isBytes ? "bytes (empty: no data, 0x)" : "string"}
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
    <Field htmlFor={id} name={name} paramName={paramName} type={param.type} typeInInput doc={doc}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={fixedBytes ? `${param.type} (0x + ${Number(fixedBytes[1]) * 2} hex characters)` : param.type}
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
export function displayTypeWithBase(param: AbiParam): string {
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

/**
 * A struct or a list: a title bar that opens and closes the fields under it. It starts closed, so a function
 * with large structs stays short. The fields sit under the bar, behind a line on the left.
 */
function Group({
  name,
  type,
  detail,
  action,
  json,
  children,
}: {
  name: string;
  type: string;
  detail?: string;
  /** A control at the end of the title bar */
  action?: React.ReactNode;
  /** The "paste as JSON" editor: `render` gets a function that closes it */
  json: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const bodyId = useId();
  return (
    <div role="group" aria-label={name} className="min-w-0">
      <div className="flex min-w-0 items-center gap-1 rounded-md bg-gray-200/70 pr-1.5 hover:bg-gray-200">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cerulean-blue-500"
        >
          <IoChevronForward
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="shrink-0 font-semibold text-gray-900">{name}</span>
          <span className="min-w-0 truncate font-mono text-xs text-gray-600">{type}</span>
          {detail && (
            <span className="hidden shrink-0 whitespace-nowrap text-xs text-gray-500 sm:inline">{detail}</span>
          )}
        </button>
        <button
          type="button"
          className={buttonQuiet}
          aria-expanded={open && jsonOpen}
          onClick={() => {
            // The JSON editor is part of the fields: open the group with it
            setJsonOpen(!(open && jsonOpen));
            setOpen(true);
          }}
        >
          <IoCodeSlash className="h-3.5 w-3.5" />
          JSON
        </button>
        {action}
      </div>
      {open && (
        <div id={bodyId} className="ml-[15px] border-l-2 border-gray-300 pb-1 pl-4 pt-3">
          {jsonOpen && json(() => setJsonOpen(false))}
          {children}
        </div>
      )}
    </div>
  );
}

/** One input of a function: a single field, a struct (group of fields), or a list with add and remove. */
export default function ParamField(props: FieldProps) {
  const { param, value, onChange, doc, fallbackName, depth = 0, label, renderLeaf, at = "", groupAction } = props;
  const name = label || param.name || fallbackName || "value";
  const inside = (step: string) => (at ? `${at}.${step}` : step);
  const array = arrayOf(param.type);

  if (array) {
    const items = Array.isArray(value) ? value : [];
    const element = elementParam(param);
    const isSimple = !arrayOf(element.type) && element.type !== "tuple";
    const setItem = (index: number, next: FormValue) => onChange(items.map((item, i) => (i === index ? next : item)));
    // A single value has the button next to its input; a struct or a list has it in its title bar
    const removeButton = (index: number, besideInput: boolean) => (
      <button
        type="button"
        aria-label={`Remove ${name}[${index}]`}
        data-tooltip-id="global-tooltip"
        data-tooltip-content="Remove this item"
        onClick={() => onChange(items.filter((_, i) => i !== index))}
        className={`${besideInput ? "mt-[26px]" : ""} shrink-0 cursor-pointer rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cerulean-blue-500`}
      >
        <IoTrashOutline className="h-4 w-4" />
      </button>
    );
    return (
      <Group
        name={name}
        type={displayType(param)}
        detail={
          array.length !== null
            ? `fixed list of ${array.length}`
            : `${items.length} ${items.length === 1 ? "item" : "items"}`
        }
        action={groupAction}
        json={(close) => <JsonPaste {...props} onClose={close} />}
      >
        {doc && <NatSpecNote kind="param" text={doc} className="mb-3" />}
        {items.length === 0 && <p className="mb-2 text-sm text-gray-500">The list is empty. That is a valid value.</p>}
        <ol className="space-y-4">
          {items.map((item, index) => (
            <li key={index} className={isSimple ? "flex items-start gap-2" : undefined}>
              <div className="min-w-0 flex-1">
                <ParamField
                  param={element}
                  value={item}
                  onChange={(next) => setItem(index, next)}
                  fallbackName={`${name}[${index}]`}
                  depth={depth + 1}
                  renderLeaf={renderLeaf}
                  at={inside("[]")}
                  groupAction={isSimple || array.length !== null ? undefined : removeButton(index, false)}
                />
              </div>
              {isSimple && array.length === null && removeButton(index, true)}
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
      </Group>
    );
  }

  if (param.type === "tuple") {
    const components = param.components ?? [];
    const fields = Array.isArray(value) ? value : [];
    return (
      <Group
        name={name}
        type={displayType(param)}
        detail={`struct, ${components.length} fields`}
        action={groupAction}
        json={(close) => <JsonPaste {...props} onClose={close} />}
      >
        {doc && <NatSpecNote kind="param" text={doc} className="mb-3" />}
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
              renderLeaf={renderLeaf}
              at={inside(String(index))}
            />
          ))}
        </div>
      </Group>
    );
  }

  return renderLeaf?.(at, props) ?? <LeafField {...props} />;
}
