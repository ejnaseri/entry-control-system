import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

type TableVariant = "default" | "compact" | "report";
type CellAlign = "start" | "center" | "end";

type DataTableShellProps = HTMLAttributes<HTMLDivElement> & {
  scrollClassName?: string;
};

type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  fixed?: boolean;
  minWidth?: string;
  variant?: TableVariant;
};

type DataTableRowProps = HTMLAttributes<HTMLTableRowElement> & {
  clickable?: boolean;
};

type DataTableCellProps = Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: CellAlign;
};

type DataTableHeaderCellProps = Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & {
  align?: CellAlign;
};

export function DataTableShell({ children, className, scrollClassName, ...props }: DataTableShellProps) {
  return (
    <div className={joinClasses("app-table-shell", className)} {...props}>
      <div className={joinClasses("app-table-scroll", scrollClassName)}>{children}</div>
    </div>
  );
}

export function DataTable({ children, className, fixed, minWidth, variant = "default", style, ...props }: DataTableProps) {
  const tableStyle: CSSProperties | undefined = minWidth ? { ...style, minWidth } : style;
  return (
    <table
      className={joinClasses("app-table", `app-table--${variant}`, fixed ? "app-table--fixed" : undefined, className)}
      style={tableStyle}
      {...props}
    >
      {children}
    </table>
  );
}

export function DataTableHead({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={joinClasses("app-table-head", className)} {...props}>
      {children}
    </thead>
  );
}

export function DataTableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={joinClasses("app-table-body", className)} {...props}>
      {children}
    </tbody>
  );
}

export function DataTableRow({ children, className, clickable, onClick, onKeyDown, tabIndex, ...props }: DataTableRowProps) {
  const keyboardInteractive = clickable && Boolean(onClick);
  return (
    <tr
      className={joinClasses("app-table-row", clickable ? "app-table-row--clickable" : undefined, className)}
      onClick={onClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !keyboardInteractive || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
      tabIndex={keyboardInteractive ? tabIndex ?? 0 : tabIndex}
      {...props}
    >
      {children}
    </tr>
  );
}

export function DataTableHeaderCell({ children, className, align = "start", ...props }: DataTableHeaderCellProps) {
  return (
    <th className={joinClasses("app-table-cell", "app-table-header-cell", `app-table-cell--${align}`, className)} {...props}>
      {children}
    </th>
  );
}

export function DataTableCell({ children, className, align = "start", ...props }: DataTableCellProps) {
  return (
    <td className={joinClasses("app-table-cell", `app-table-cell--${align}`, className)} {...props}>
      {children}
    </td>
  );
}

export function DataTableEmptyRow({ colSpan, children, className }: { colSpan: number; children: ReactNode; className?: string }) {
  return (
    <DataTableRow>
      <DataTableCell colSpan={colSpan} align="center" className={joinClasses("app-table-empty", className)}>
        {children}
      </DataTableCell>
    </DataTableRow>
  );
}

export function DataTableSkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <DataTableRow key={`loading-${rowIndex}`}>
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <DataTableCell key={cellIndex}>
              <span className="app-table-skeleton" />
            </DataTableCell>
          ))}
        </DataTableRow>
      ))}
    </>
  );
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
