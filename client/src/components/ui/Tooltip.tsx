import type { ReactNode } from "react";

export type TooltipSide = "top" | "right" | "bottom" | "left";

type TooltipProps = {
  children: ReactNode;
  label: ReactNode;
  side?: TooltipSide;
  className?: string;
};

const tooltipSideClasses = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0",
  right: "left-full top-1/2 ml-2 -translate-x-1 -translate-y-1/2 group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0",
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2 -translate-y-1 group-hover/tooltip:translate-y-0 group-focus-within/tooltip:translate-y-0",
  left: "right-full top-1/2 mr-2 -translate-y-1/2 translate-x-1 group-hover/tooltip:translate-x-0 group-focus-within/tooltip:translate-x-0",
} satisfies Record<TooltipSide, string>;

const arrowSideClasses = {
  top: "left-1/2 top-full -translate-x-1/2 -translate-y-1/2 border-b border-r",
  right: "right-full top-1/2 translate-x-1/2 -translate-y-1/2 border-b border-l",
  bottom: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-l border-t",
  left: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2 border-r border-t",
} satisfies Record<TooltipSide, string>;

export function Tooltip({ children, label, side = "top", className }: TooltipProps) {
  return (
    <span className={`group/tooltip relative inline-flex ${className ?? ""}`}>
      {children}
      <span
        role="tooltip"
        className={`app-tooltip pointer-events-none absolute z-40 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[10px] font-medium opacity-0 backdrop-blur-sm transition-all duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${tooltipSideClasses[side]}`}
      >
        <span aria-hidden="true" className={`app-tooltip__arrow absolute h-2 w-2 rotate-45 ${arrowSideClasses[side]}`} />
        {label}
      </span>
    </span>
  );
}
