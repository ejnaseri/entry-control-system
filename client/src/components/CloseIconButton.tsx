import type { ButtonHTMLAttributes } from "react";
import { IconX } from "@tabler/icons-react";

type CloseIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md";
};

export function CloseIconButton({ label, size = "md", className = "", ...props }: CloseIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`close-icon-button ${size === "sm" ? "close-icon-button--sm" : ""} ${className}`.trim()}
      {...props}
    >
      <IconX className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} stroke={2} aria-hidden />
    </button>
  );
}
