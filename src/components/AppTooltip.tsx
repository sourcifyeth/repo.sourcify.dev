"use client";

import { Tooltip } from "react-tooltip";

// This component is used to render a global tooltip that can be used across the application
// It should be included once at the root level of the application
export default function AppTooltip() {
  return (
    <Tooltip
      id="global-tooltip"
      place="top"
      className="z-50 text-xs py-1 px-2"
      style={{
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        borderRadius: "4px",
        opacity: 1,
      }}
      opacity={1}
      arrowColor="#1a1a1a"
      clickable={true}
      positionStrategy="fixed"
    />
  );
}
