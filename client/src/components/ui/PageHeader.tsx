import { useId, type HTMLAttributes, type ReactNode } from "react";

type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ actions, className, description, eyebrow, icon, title, ...props }: PageHeaderProps) {
  const headingId = useId();

  return (
    <header className={joinClasses("app-page-header", className)} aria-labelledby={headingId} {...props}>
      <div className="app-page-header__identity">
        {icon ? <span className="app-page-header__icon" aria-hidden="true">{icon}</span> : null}
        <div className="app-page-header__copy">
          {eyebrow ? <p className="app-page-header__eyebrow">{eyebrow}</p> : null}
          <h1 id={headingId} className="app-page-header__title">{title}</h1>
          {description ? <p className="app-page-header__description">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="app-page-header__actions">{actions}</div> : null}
    </header>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
