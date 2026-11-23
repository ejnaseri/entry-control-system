import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SVGProps } from "react";
import { createPortal } from "react-dom";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DropdownSelectProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  buttonClassName?: string;
  containerClassName?: string;
  menuClassName?: string;
  menuSide?: "start" | "end" | "auto";
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  testId?: string;
};

export function DropdownSelect({
  value,
  options,
  onChange,
  ariaLabel,
  buttonClassName = "",
  containerClassName = "",
  menuClassName = "",
  menuSide = "auto",
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  noResultsLabel = "No results",
  testId,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [disabledSnapshot, setDisabledSnapshot] = useState(disabled);
  const [resolvedMenuSide, setResolvedMenuSide] = useState<"start" | "end">("start");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [menuListMaxHeight, setMenuListMaxHeight] = useState(224);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const fallbackLabel = options[0]?.label ?? "";
  const displayLabel = selectedOption?.label ?? fallbackLabel;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleOptions = useMemo(() => {
    if (!searchable || !normalizedSearchQuery) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedSearchQuery));
  }, [normalizedSearchQuery, options, searchable]);

  if (disabledSnapshot !== disabled) {
    setDisabledSnapshot(disabled);
    if (disabled) {
      if (open) setOpen(false);
      if (searchQuery) setSearchQuery("");
    }
  }

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;

    const resolveSide = () => {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const safePadding = 12;
      const estimatedMenuWidth = Math.min(Math.max(rect.width, 200), viewportWidth - safePadding * 2);

      const availableRight = viewportWidth - rect.left - safePadding;
      const availableLeft = rect.right - safePadding;

      const preferred: "start" | "end" = menuSide === "auto" ? "start" : menuSide;
      let nextSide: "start" | "end" = preferred;

      if (preferred === "start" && estimatedMenuWidth > availableRight) {
        nextSide = "end";
      } else if (preferred === "end" && estimatedMenuWidth > availableLeft) {
        nextSide = "start";
      }

      if (estimatedMenuWidth > (nextSide === "start" ? availableRight : availableLeft)) {
        nextSide = availableRight >= availableLeft ? "start" : "end";
      }

      setResolvedMenuSide(nextSide);

      const direction = window.getComputedStyle(rootRef.current).direction;
      const alignLeft = (nextSide === "start" && direction !== "rtl") || (nextSide === "end" && direction === "rtl");
      const idealLeft = alignLeft ? rect.left : rect.right - estimatedMenuWidth;
      const left = Math.min(Math.max(safePadding, idealLeft), viewportWidth - estimatedMenuWidth - safePadding);
      const estimatedMenuHeight = searchable ? 260 : 230;
      const roomBelow = window.innerHeight - rect.bottom - safePadding;
      const roomAbove = rect.top - safePadding;
      const openAbove = roomBelow < Math.min(estimatedMenuHeight, 180) && roomAbove > roomBelow;
      const availableHeight = Math.max(120, openAbove ? roomAbove - 4 : roomBelow - 4);
      setMenuListMaxHeight(Math.max(72, Math.min(searchable ? 192 : 224, availableHeight - (searchable ? 58 : 12))));
      setMenuStyle({
        left,
        minWidth: rect.width,
        maxWidth: Math.min(280, viewportWidth - safePadding * 2),
        maxHeight: Math.min(estimatedMenuHeight, availableHeight),
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 4, top: "auto" } : { top: rect.bottom + 4, bottom: "auto" }),
      });
    };

    resolveSide();
    window.addEventListener("resize", resolveSide);
    window.addEventListener("scroll", resolveSide, true);
    return () => {
      window.removeEventListener("resize", resolveSide);
      window.removeEventListener("scroll", resolveSide, true);
    };
  }, [open, menuSide, searchable]);

  useEffect(() => {
    if (!open) return;
    if (!searchable) return;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, searchable]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        data-testid={testId}
        className={`${buttonClassName} attendance-select__button flex w-full items-center justify-between gap-2 text-start ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-brand-500/10"
        }`}
        onClick={() => {
          if (!disabled) {
            if (open) closeMenu();
            else setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        disabled={disabled}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon className={`attendance-select__chevron h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled ? createPortal(
        <div
          ref={menuRef}
          data-side={resolvedMenuSide}
          style={menuStyle}
          className={`attendance-select__menu fixed z-[100] w-max overflow-hidden rounded-xl border backdrop-blur ${menuClassName}`}
        >
          {searchable ? (
            <div className="attendance-select__search-wrap">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="attendance-select__search-input"
              />
            </div>
          ) : null}
          <div role="listbox" className="overflow-auto" style={{ maxHeight: menuListMaxHeight }}>
            {visibleOptions.length ? visibleOptions.map((option, index) => {
              const isSelected = option.value === value;
              const isDisabled = Boolean(option.disabled);
              const key = option.value === "" ? `empty-${index}` : option.value;
              return (
                <button
                  key={key}
                  type="button"
                  data-value={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled || undefined}
                  disabled={isDisabled}
                  className={`attendance-select__option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  } ${isDisabled ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (isDisabled) return;
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    closeMenu();
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <CheckIcon className="attendance-select__check h-3 w-3" /> : null}
                </button>
              );
            }) : <div className="attendance-select__empty">{noResultsLabel}</div>}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
