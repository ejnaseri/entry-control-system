import type { HTMLAttributes, ReactNode } from "react";

type StatePanelProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "empty" | "error";
};

export function StatePanel({ action, className, description, icon, title, tone = "empty", ...props }: StatePanelProps) {
  return (
    <div
      className={joinClasses("app-state-panel", `app-state-panel--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    >
      {icon ? <span className="app-state-panel__icon" aria-hidden="true">{icon}</span> : null}
      <div className="app-state-panel__copy">
        <p className="app-state-panel__title">{title}</p>
        {description ? <p className="app-state-panel__description">{description}</p> : null}
      </div>
      {action ? <div className="app-state-panel__action">{action}</div> : null}
    </div>
  );
}

export function EmptyState(props: Omit<StatePanelProps, "tone">) {
  return <StatePanel tone="empty" {...props} />;
}

export function ErrorState(props: Omit<StatePanelProps, "tone">) {
  return <StatePanel tone="error" {...props} />;
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
