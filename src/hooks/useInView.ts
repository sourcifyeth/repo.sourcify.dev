"use client";

import { RefObject, useEffect, useState } from "react";

/**
 * True once the element comes near the visible part of the page, and stays
 * true. `margin` widens the area (CSS margin syntax, as in IntersectionObserver).
 * `delay` (ms) ignores elements that only pass by, for example during a smooth
 * scroll to a section further down.
 */
export function useInView(ref: RefObject<Element | null>, { margin = "300px 0px", delay = 0 } = {}): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (inView || !element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay === 0) setInView(true);
          else if (timer === null) timer = setTimeout(() => setInView(true), delay);
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { rootMargin: margin }
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
    };
  }, [ref, inView, margin, delay]);
  return inView;
}
