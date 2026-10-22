import { describe, expect, it } from "vitest";
import { shortcutLabel } from "./shortcuts";

describe("shortcutLabel", () => {
  it("uses macOS symbols in the standard order", () => {
    expect(shortcutLabel(true, "F", { shift: true })).toBe("⇧⌘F");
    expect(shortcutLabel(true, "C", { alt: true, mod: false })).toBe("⌥C");
  });

  it("spells out the keys on other platforms", () => {
    expect(shortcutLabel(false, "F", { shift: true })).toBe("Ctrl+Shift+F");
    expect(shortcutLabel(false, "P")).toBe("Ctrl+P");
    expect(shortcutLabel(false, "C", { alt: true, mod: false })).toBe("Alt+C");
  });
});
