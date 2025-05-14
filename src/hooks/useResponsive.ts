import { useState, useEffect } from "react";

// Tailwind's md breakpoint in pixels
const MD_BREAKPOINT = 768;

/**
 * Hook that returns screen size information and whether the screen is mobile
 * @returns Object with width, height, and isMobile
 */
export function useScreenSize() {
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    isMobile: typeof window !== "undefined" ? window.innerWidth < MD_BREAKPOINT : false,
  });

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
