import type { KeyboardEvent } from "react";

/** Arrow keys move the focus between the links of a list. Enter on a focused link opens it. */
export function moveFocusInList(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const links = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  const next = e.key === "ArrowDown" ? current + 1 : current - 1;
  if (next >= 0 && next < links.length) {
    e.preventDefault();
    e.stopPropagation();
    links[next].focus();
  }
}
