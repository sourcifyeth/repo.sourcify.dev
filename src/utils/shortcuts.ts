/**
 * Shortcut labels for the user's platform. macOS uses the symbols in the
 * standard order (⌃⌥⇧⌘, then the key); other platforms spell them out.
 */
export function shortcutLabel(isMac: boolean, key: string, { shift = false, alt = false, mod = true } = {}): string {
  if (isMac) return `${alt ? "⌥" : ""}${shift ? "⇧" : ""}${mod ? "⌘" : ""}${key}`;
  return [mod ? "Ctrl" : null, alt ? "Alt" : null, shift ? "Shift" : null, key].filter(Boolean).join("+");
}

/** The labels of the source view's shortcuts. */
export function sourceShortcuts(isMac: boolean) {
  return {
    goToFile: shortcutLabel(isMac, "P"),
    searchAll: shortcutLabel(isMac, "F", { shift: true }),
    goToSymbol: shortcutLabel(isMac, "O", { shift: true }),
    findInFile: shortcutLabel(isMac, "F"),
    matchCase: shortcutLabel(isMac, "C", { alt: true, mod: false }),
    wholeWord: shortcutLabel(isMac, "W", { alt: true, mod: false }),
    regex: shortcutLabel(isMac, "R", { alt: true, mod: false }),
    openImport: isMac ? "⌘+click" : "Ctrl+click",
  };
}

export type SourceShortcuts = ReturnType<typeof sourceShortcuts>;
