"use client";

import { useEffect, useRef, useState } from "react";
import { trackStickyHeight } from "@/utils/stickyHeight";

export interface PageSection {
  id: string;
  label: string;
}

/**
 * A bar of links to the sections of the contract page. It sticks below the
 * staging banner while you scroll, and marks the section you are in. A click
 * scrolls to the section without changing the URL hash, because the hash
 * holds the source position (#file=…).
 */
export default function SectionNav({ sections }: { sections: PageSection[] }) {
  const navRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => trackStickyHeight(navRef.current, "--section-nav-height"), []);

  // The current section: the last one whose top has passed the bottom of the sticky bars
  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const offset = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 16;
      // At the top of the page, the first section counts as current
      let current: string | null = sections[0]?.id ?? null;
      for (const { id } of sections) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= offset) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [sections]);

  // On narrow screens the bar scrolls sideways: keep the current link in view. This moves only
  // the bar's list (scrollLeft); scrollIntoView would also move the page and stop a smooth scroll.
  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!list || !item) return;
    const left = item.getBoundingClientRect().left - list.getBoundingClientRect().left + list.scrollLeft;
    if (left < list.scrollLeft) list.scrollLeft = left - 8;
    else if (left + item.offsetWidth > list.scrollLeft + list.clientWidth)
      list.scrollLeft = left + item.offsetWidth - list.clientWidth + 8;
  }, [active]);

  const go = (id: string) => {
    // scroll-margin-top (class page-section) keeps the section below the sticky bars
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <nav
      ref={navRef}
      data-sticky-top
      aria-label="Sections of this page"
      className="sticky z-40 -mx-2 mb-2 border-b border-gray-200 bg-gray-100/95 px-2 backdrop-blur"
      style={{ top: "var(--sticky-banner-height)" }}
    >
      <ul ref={listRef} className="flex gap-1 overflow-x-auto whitespace-nowrap py-1.5 text-sm">
        {sections.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              data-section={id}
              onClick={() => go(id)}
              aria-current={active === id ? "location" : undefined}
              className={`rounded px-2 py-1 cursor-pointer transition-colors ${
                active === id ? "bg-white text-gray-900 font-medium shadow-sm" : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
