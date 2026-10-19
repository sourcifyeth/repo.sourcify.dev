"use client";

import { useEffect, useRef, useState } from "react";
import { IoCheckmark, IoChevronDown } from "react-icons/io5";
import { moveFocusInList } from "@/utils/listKeyboard";

export interface DropdownOption {
  value: string;
  label: string;
  /** Small grey text after the label, e.g. a chain ID */
  detail?: string;
}

interface OptionDropdownProps {
  id?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Show the filter input only when the list is long enough to need it
const FILTER_THRESHOLD = 8;

/**
 * A select with the same look as the search dropdown on the home page:
 * a white button, and a floating grey panel with a white list.
 */
export default function OptionDropdown({ id, options, value, onChange, disabled }: OptionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);
  const query = filter.trim().toLowerCase();
  const visible = query
    ? options.filter(
        (option) => option.label.toLowerCase().includes(query) || option.detail?.toLowerCase().includes(query)
      )
    : options;

  // Close on a click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  // When the list opens, focus the selected option (or the filter, if there is one)
  useEffect(() => {
    if (!isOpen) return;
    const selectedOption = listRef.current?.querySelector<HTMLElement>("[aria-selected=true]");
    selectedOption?.scrollIntoView({ block: "nearest" });
    if (options.length <= FILTER_THRESHOLD) selectedOption?.focus();
  }, [isOpen, options.length]);

  const close = () => {
    setIsOpen(false);
    setFilter("");
    buttonRef.current?.focus();
  };

  const choose = (option: DropdownOption) => {
    onChange(option.value);
    close();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && isOpen) {
          e.preventDefault();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className="flex w-full items-center gap-2 pl-3 pr-2 py-2 text-sm text-left bg-white border border-gray-300 rounded-md cursor-pointer text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-cerulean-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex-1 truncate">
          {selected ? (
            <>
              {selected.label}
              {selected.detail && <span className="ml-1.5 text-xs text-gray-500">{selected.detail}</span>}
            </>
          ) : (
            "Select…"
          )}
        </span>
        <IoChevronDown className={`shrink-0 w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 shadow-xl text-left">
          {options.length > FILTER_THRESHOLD && (
            <input
              type="text"
              autoFocus
              aria-label="Filter"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  listRef.current?.querySelector<HTMLElement>("[role=option]")?.focus();
                } else if (e.key === "Enter" && visible.length > 0) {
                  e.preventDefault();
                  choose(visible[0]);
                }
              }}
              className="mb-2 w-full px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cerulean-blue-500"
            />
          )}
          <ul
            ref={listRef}
            role="listbox"
            onKeyDown={moveFocusInList}
            className="scrollbar-visible max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100"
          >
            {visible.map((option) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onClick={() => choose(option)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      choose(option);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-cerulean-blue-100 focus:bg-cerulean-blue-100 focus:outline-none"
                >
                  <span className={`flex-1 truncate ${isSelected ? "font-medium text-gray-900" : "text-gray-800"}`}>
                    {option.label}
                    {option.detail && <span className="ml-1.5 text-xs text-gray-500">{option.detail}</span>}
                  </span>
                  {isSelected && <IoCheckmark className="shrink-0 w-4 h-4 text-cerulean-blue-600" />}
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matches for “{filter}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
