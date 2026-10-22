import { useState, useEffect } from "react";

// Tailwind's md breakpoint in pixels
const MD_BREAKPOINT = 768;

/**
 * Hook that returns screen size information and whether the screen is mobile
 * @returns Object with width, height, and isMobile
 */
export function useScreenSize() {
  // The first render must match the server's HTML, which knows no window size:
  // start with the server's values, and read the window in the effect below.
  // (Reading the window here made React reject the server HTML on narrow screens.)
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0, isMobile: false });

  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < MD_BREAKPOINT,
      });
    };

    // Set initial values
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Clean up event listener on unmount
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return screenSize;
}

/**
 * Simple hook that returns whether the current screen is mobile (smaller than md breakpoint)
 * @returns Boolean indicating if the current screen is mobile-sized
 */
export function useIsMobile() {
  const { isMobile } = useScreenSize();
  return isMobile;
}
