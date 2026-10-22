/**
 * Bars that stick to the top of the window (the staging banner, the section
 * bar) publish their height as CSS variables on <html>: --sticky-banner-height
 * and --section-nav-height. The section bar sticks below the banner, and jumps
 * to a section stop below both (see .page-section in globals.css).
 */
export function trackStickyHeight(element: HTMLElement | null, variable: string): () => void {
  const root = document.documentElement;
  if (!element || typeof ResizeObserver === "undefined") {
    root.style.setProperty(variable, "0px");
    return () => {};
  }
  const observer = new ResizeObserver(() => {
    root.style.setProperty(variable, `${element.getBoundingClientRect().height}px`);
  });
  observer.observe(element);
  return () => {
    observer.disconnect();
    root.style.setProperty(variable, "0px");
  };
}
