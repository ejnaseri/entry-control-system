import type { HTMLAttributes, ReactNode } from "react";

export type SummaryCardTone = "neutral" | "brand" | "success" | "warning" | "danger";

type SummaryCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: SummaryCardTone;
};

export function SummaryCard({ className, detail, icon, label, tone = "neutral", value, ...props }: SummaryCardProps) {
  return (
    <article className={joinClasses("app-summary-card", `app-summary-card--${tone}`, className)} {...props}>
      <div className="app-summary-card__heading">
        <p className="app-summary-card__label">{label}</p>
        {icon ? <span className="app-summary-card__icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="app-summary-card__value">{value}</p>
      {detail ? <div className="app-summary-card__detail">{detail}</div> : null}
    </article>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
