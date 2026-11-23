import type { ReactNode } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../../i18n/config";

type PaginationButtonVariant = "icon" | "text";

type PaginationControlsProps = {
  buttonVariant?: PaginationButtonVariant;
  canNext?: boolean;
  canPrevious?: boolean;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  endItem?: number;
  maxPageButtons?: number;
  nextLabel?: ReactNode;
  onNext?: () => void;
  onPageChange?: (page: number) => void;
  onPrevious?: () => void;
  page?: number;
  pageLabel?: ReactNode;
  pageSize?: number;
  previousLabel?: ReactNode;
  rangeLabel?: ReactNode;
  ariaLabel?: string;
  showFirstLast?: boolean;
  showPageSize?: boolean;
  startItem?: number;
  totalItems?: number;
  totalPages?: number;
};

export function PaginationControls({
  buttonVariant = "icon",
  ariaLabel,
  canNext,
  canPrevious,
  className,
  compact,
  disabled,
  endItem,
  maxPageButtons = 5,
  nextLabel,
  onNext,
  onPageChange,
  onPrevious,
  page = 1,
  pageLabel,
  pageSize,
  previousLabel,
  rangeLabel,
  showFirstLast,
  showPageSize,
  startItem,
  totalItems,
  totalPages = 1,
}: PaginationControlsProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.split("-")[0];
  const isRtl = rtlLanguages.includes(language);
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = clamp(page, 1, safeTotalPages);
  const numberLocale = resolveNumberLocale(i18n.language);

  const resolvedCanPrevious = !disabled && (canPrevious ?? safePage > 1);
  const resolvedCanNext = !disabled && (canNext ?? safePage < safeTotalPages);
  const formattedPage = formatNumber(safePage, numberLocale);
  const formattedTotalPages = formatNumber(safeTotalPages, numberLocale);
  const computedStart =
    typeof totalItems === "number" && totalItems > 0
      ? startItem ?? (pageSize ? (safePage - 1) * pageSize + 1 : 1)
      : 0;
  const computedEnd =
    typeof totalItems === "number" && totalItems > 0
      ? endItem ?? (pageSize ? Math.min(totalItems, safePage * pageSize) : totalItems)
      : 0;
  const resolvedRangeLabel =
    rangeLabel ??
    (typeof totalItems === "number"
      ? t("common.pagination.range", {
          start: formatNumber(computedStart, numberLocale),
          end: formatNumber(computedEnd, numberLocale),
          total: formatNumber(totalItems, numberLocale),
        })
      : null);
  const resolvedPageLabel =
    pageLabel ??
    t("common.pagination.pageOf", {
      page: formattedPage,
      total: formattedTotalPages,
    });
  const resolvedPageSizeLabel =
    pageSize && showPageSize
      ? t("common.pagination.perPage", { value: formatNumber(pageSize, numberLocale) })
      : null;
  const hasMeta = Boolean(resolvedRangeLabel || resolvedPageSizeLabel);
  const pageTokens = onPageChange ? getPageTokens(safePage, safeTotalPages, maxPageButtons) : [];

  const previousIcon = isRtl ? IconChevronRight : IconChevronLeft;
  const nextIcon = isRtl ? IconChevronLeft : IconChevronRight;
  const firstIcon = isRtl ? IconChevronsRight : IconChevronsLeft;
  const lastIcon = isRtl ? IconChevronsLeft : IconChevronsRight;

  const handlePrevious = () => {
    if (!resolvedCanPrevious) return;
    if (onPrevious) {
      onPrevious();
      return;
    }
    onPageChange?.(safePage - 1);
  };

  const handleNext = () => {
    if (!resolvedCanNext) return;
    if (onNext) {
      onNext();
      return;
    }
    onPageChange?.(safePage + 1);
  };

  return (
    <nav
      className={joinClasses("app-pagination", compact && "app-pagination--compact", className)}
      aria-label={ariaLabel ?? t("common.pagination.label")}
    >
      {hasMeta ? (
        <div className="app-pagination__meta">
          {resolvedRangeLabel ? (
            <span className="app-pagination__range">
              <span className="app-pagination__range-dot" aria-hidden="true" />
              {resolvedRangeLabel}
            </span>
          ) : null}
          {resolvedPageSizeLabel ? <span className="app-pagination__page-size">{resolvedPageSizeLabel}</span> : null}
        </div>
      ) : null}
      <div className="app-pagination__controls">
        {showFirstLast && onPageChange ? (
          <PaginationButton
            ariaLabel={t("common.pagination.firstPage")}
            disabled={!resolvedCanPrevious}
            icon={firstIcon}
            onClick={() => onPageChange(1)}
            variant={buttonVariant}
          />
        ) : null}
        <PaginationButton
          ariaLabel={t("common.actions.prev")}
          disabled={!resolvedCanPrevious}
          icon={previousIcon}
          label={previousLabel ?? t("common.actions.prev")}
          onClick={handlePrevious}
          variant={buttonVariant}
        />
        {pageTokens.length > 1 ? (
          <div className="app-pagination__pages" aria-label={String(resolvedPageLabel)}>
            {pageTokens.map((token, index) =>
              token === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="app-pagination__ellipsis" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={token}
                  type="button"
                  aria-current={token === safePage ? "page" : undefined}
                  disabled={disabled || token === safePage}
                  onClick={() => onPageChange?.(token)}
                  className={joinClasses("app-pagination__page", token === safePage && "is-active")}
                >
                  {formatNumber(token, numberLocale)}
                </button>
              ),
            )}
          </div>
        ) : (
          <span className="app-pagination__page is-active">{resolvedPageLabel}</span>
        )}
        <PaginationButton
          ariaLabel={t("common.actions.next")}
          disabled={!resolvedCanNext}
          icon={nextIcon}
          label={nextLabel ?? t("common.actions.next")}
          onClick={handleNext}
          variant={buttonVariant}
        />
        {showFirstLast && onPageChange ? (
          <PaginationButton
            ariaLabel={t("common.pagination.lastPage")}
            disabled={!resolvedCanNext}
            icon={lastIcon}
            onClick={() => onPageChange(safeTotalPages)}
            variant={buttonVariant}
          />
        ) : null}
      </div>
    </nav>
  );
}

function PaginationButton({
  ariaLabel,
  disabled,
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  ariaLabel: string;
  disabled: boolean;
  icon: typeof IconChevronLeft;
  label?: ReactNode;
  onClick: () => void;
  variant: PaginationButtonVariant;
}) {
  const isText = variant === "text";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={joinClasses("app-pagination__button", isText && "app-pagination__button--text")}
    >
      {isText ? (
        label
      ) : (
        <Icon className="app-pagination__button-icon" stroke={1.9} aria-hidden="true" />
      )}
    </button>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function getPageTokens(currentPage: number, totalPages: number, maxButtons: number) {
  const visibleCount = Math.max(3, maxButtons);
  if (totalPages <= visibleCount) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= Math.ceil(visibleCount / 2)) {
    return [...range(1, visibleCount), "ellipsis" as const, totalPages];
  }

  if (currentPage >= totalPages - Math.floor(visibleCount / 2)) {
    return [1, "ellipsis" as const, ...range(totalPages - visibleCount + 1, totalPages)];
  }

  return [1, "ellipsis" as const, currentPage - 1, currentPage, currentPage + 1, "ellipsis" as const, totalPages];
}

function range(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function resolveNumberLocale(locale: string) {
  const language = locale.toLowerCase().split("-")[0];
  if (language === "fa" || language === "prs") return "fa-AF";
  if (language === "ps") return "ps-AF";
  return "en-US";
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
