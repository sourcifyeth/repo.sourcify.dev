import React from "react";
import {
  VscSymbolClass,
  VscSymbolConstant,
  VscSymbolEnum,
  VscSymbolEvent,
  VscSymbolField,
  VscSymbolInterface,
  VscSymbolMethod,
  VscSymbolNamespace,
  VscSymbolParameter,
  VscSymbolProperty,
  VscSymbolStructure,
  VscError,
} from "react-icons/vsc";
import type { SymbolKind } from "@/utils/sourceSymbols";

const ICONS: Record<SymbolKind, { Icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  contract: { Icon: VscSymbolClass, color: "text-orange-300", label: "contract" },
  abstractContract: { Icon: VscSymbolClass, color: "text-orange-300", label: "abstract contract" },
  interface: { Icon: VscSymbolInterface, color: "text-sky-300", label: "interface" },
  library: { Icon: VscSymbolNamespace, color: "text-teal-300", label: "library" },
  function: { Icon: VscSymbolMethod, color: "text-violet-300", label: "function" },
  constructor: { Icon: VscSymbolMethod, color: "text-violet-300", label: "constructor" },
  fallback: { Icon: VscSymbolMethod, color: "text-violet-300", label: "fallback" },
  receive: { Icon: VscSymbolMethod, color: "text-violet-300", label: "receive" },
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

export default function SymbolIcon({ kind, className = "w-3.5 h-3.5" }: { kind: SymbolKind; className?: string }) {
  const { Icon, color, label } = ICONS[kind];
  return (
    <span className={`shrink-0 ${color}`} title={label} aria-hidden="true">
      <Icon className={className} />
    </span>
  );
}
