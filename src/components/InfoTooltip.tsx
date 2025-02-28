"use client";

import { IoMdInformationCircleOutline } from "react-icons/io";

interface InfoTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
  html?: boolean;
}

export default function InfoTooltip({
  content,
  className = "",
  iconClassName = "text-gray-400 hover:text-gray-600",
  html = false,
}: InfoTooltipProps) {
  return (
    <span
      className={`inline-flex items-center cursor-help ${className}`}
      data-tooltip-id="global-tooltip"
      data-tooltip-content={html ? undefined : content}
      data-tooltip-html={html ? content : undefined}
    >
      <IoMdInformationCircleOutline className={`text-lg ${iconClassName}`} />
    </span>
  );
}
