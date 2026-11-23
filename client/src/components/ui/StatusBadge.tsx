import type { HTMLAttributes, ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: StatusBadgeTone;
  withDot?: boolean;
};

export function StatusBadge({ children, className, tone = "neutral", withDot = true, ...props }: StatusBadgeProps) {
  return (
    <span className={joinClasses("app-status-badge", `app-status-badge--${tone}`, className)} {...props}>
      {withDot ? <span className="app-status-badge__dot" aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
