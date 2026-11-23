import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
};

export function Button({
  "aria-label": ariaLabel,
  children,
  className,
  disabled,
  endIcon,
  loading = false,
  loadingLabel,
  size = "md",
  startIcon,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={joinClasses("app-button", `app-button--${variant}`, `app-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={loading && loadingLabel ? loadingLabel : ariaLabel}
      {...props}
    >
      {loading ? <span className="app-button__spinner" aria-hidden="true" /> : startIcon ? <span className="app-button__icon" aria-hidden="true">{startIcon}</span> : null}
      <span className="app-button__label">{children}</span>
      {!loading && endIcon ? <span className="app-button__icon" aria-hidden="true">{endIcon}</span> : null}
    </button>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
