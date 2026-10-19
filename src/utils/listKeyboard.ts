import type { KeyboardEvent } from "react";

/** Arrow keys move the focus between the links (or options) of a list. Enter on a focused item opens it. */
export function moveFocusInList(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("a, [role=option]"));
  const current = links.indexOf(document.activeElement as HTMLElement);
  const next = e.key === "ArrowDown" ? current + 1 : current - 1;
  if (next >= 0 && next < links.length) {
    e.preventDefault();
    e.stopPropagation();
    links[next].focus();
  }
}
