import React from "react";
import {
  VscSymbolClass,
  VscSymbolConstant,
  VscSymbolEnum,
  VscSymbolEvent,
  VscSymbolField,
  VscSymbolInterface,
  VscSymbolNamespace,
  VscSymbolParameter,
  VscSymbolProperty,
  VscSymbolStructure,
  VscError,
} from "react-icons/vsc";
import type { SymbolKind } from "@/utils/sourceSymbols";

// A text glyph for functions: codicons have no clear "function" icon (VS Code's method icon is a cube)
function FunctionGlyph({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-bold leading-none text-[9px] tracking-tighter ${className ?? ""}`}
    >
      fn
    </span>
  );
}

const ICONS: Record<SymbolKind, { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  contract: { Icon: VscSymbolClass, color: "text-orange-300", label: "contract" },
  abstractContract: { Icon: VscSymbolClass, color: "text-orange-300", label: "abstract contract" },
  interface: { Icon: VscSymbolInterface, color: "text-sky-300", label: "interface" },
  library: { Icon: VscSymbolNamespace, color: "text-teal-300", label: "library" },
  function: { Icon: FunctionGlyph, color: "text-violet-300", label: "function" },
  constructor: { Icon: FunctionGlyph, color: "text-violet-300", label: "constructor" },
  fallback: { Icon: FunctionGlyph, color: "text-violet-300", label: "fallback" },
  receive: { Icon: FunctionGlyph, color: "text-violet-300", label: "receive" },
  modifier: { Icon: VscSymbolProperty, color: "text-cyan-300", label: "modifier" },
  event: { Icon: VscSymbolEvent, color: "text-amber-300", label: "event" },
  error: { Icon: VscError, color: "text-rose-300", label: "error" },
  struct: { Icon: VscSymbolStructure, color: "text-sky-300", label: "struct" },
  enum: { Icon: VscSymbolEnum, color: "text-orange-300", label: "enum" },
  stateVariable: { Icon: VscSymbolField, color: "text-sky-300", label: "state variable" },
  constant: { Icon: VscSymbolConstant, color: "text-sky-300", label: "constant" },
  userType: { Icon: VscSymbolParameter, color: "text-teal-300", label: "type" },
};

export const symbolKindLabel = (kind: SymbolKind) => ICONS[kind].label;

/**
 * The icon of a symbol kind: VS Code's symbol icons (codicons), except "fn"
 * for functions. A tooltip names the kind.
 */
export default function SymbolIcon({ kind, className = "w-3.5 h-3.5" }: { kind: SymbolKind; className?: string }) {
  const { Icon, color, label } = ICONS[kind];
  return (
    <span
      className={`shrink-0 inline-flex ${color}`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={label}
      aria-hidden="true"
    >
      <Icon className={className} />
    </span>
  );
}
