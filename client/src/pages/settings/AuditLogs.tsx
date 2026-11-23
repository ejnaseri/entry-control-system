import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  IconActivity,
  IconAlertTriangle,
  IconCheck,
  IconEye,
  IconFilter,
  IconHistory,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";
import {
  getAuditLog,
  getAuditLogOptions,
  listAuditLogs,
  type AuditLogDetail,
  type AuditLogItem,
  type AuditLogListResponse,
  type AuditLogOptions,
} from "../../api/auditLogs";
import type { AdminRole } from "../../api/auth";
import { CloseIconButton } from "../../components/CloseIconButton";
import { Button } from "../../components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRows,
} from "../../components/ui/DataTable";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { PageHeader } from "../../components/ui/PageHeader";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
import { ErrorState } from "../../components/ui/StatePanel";
import { StatusBadge as AppStatusBadge } from "../../components/ui/StatusBadge";
import { SummaryCard } from "../../components/ui/SummaryCard";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { resolveDateLocale } from "../../shared/dateLocale";
import { rtlLanguages } from "../../i18n/config";

const PAGE_SIZE = 20;

type ResultFilter = "" | "success" | "failed";

type Filters = {
  search: string;
  actorId: string;
  action: string;
  targetType: string;
  result: ResultFilter;
  from: string;
  to: string;
};

const emptyFilters: Filters = {
  search: "",
  actorId: "",
  action: "",
  targetType: "",
  result: "",
  from: "",
  to: "",
};

const emptyData: AuditLogListResponse = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  summary: { total: 0, successful: 0, failed: 0 },
};

export function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language.split("-")[0] || "en";
  const isRtl = rtlLanguages.includes(language);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditLogListResponse>(emptyData);
  const [options, setOptions] = useState<AuditLogOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    getAuditLogOptions()
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("settings.auditLogs.errors.options"));
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listAuditLogs({
      page,
      pageSize: PAGE_SIZE,
      search: filters.search.trim() || undefined,
      actorId: filters.actorId || undefined,
      action: filters.action || undefined,
      targetType: filters.targetType || undefined,
      success: filters.result ? filters.result === "success" : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : t("settings.auditLogs.errors.load"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters, page, refreshKey, t]);

  const actorOptions = useMemo(
    () => [
      { value: "", label: t("settings.auditLogs.filters.allActors") },
      ...(options?.actors ?? []).map((actor) => ({
        value: actor.id,
        label: `${actor.fullName?.trim() || actor.username} · ${formatRole(actor.role, t)}`,
      })),
    ],
    [options?.actors, t]
  );

  const actionOptions = useMemo(
    () => [
      { value: "", label: t("settings.auditLogs.filters.allActions") },
      ...(options?.actions ?? []).map((action) => ({ value: action, label: formatAction(action, t) })),
    ],
    [options?.actions, t]
  );

  const targetOptions = useMemo(
    () => [
      { value: "", label: t("settings.auditLogs.filters.allTargets") },
      ...(options?.targetTypes ?? []).map((targetType) => ({
        value: targetType,
        label: formatTargetType(targetType, t),
      })),
    ],
    [options?.targetTypes, t]
  );

  const resultOptions = useMemo(
    () => [
      { value: "", label: t("settings.auditLogs.filters.allResults") },
      { value: "success", label: t("settings.auditLogs.status.success") },
      { value: "failed", label: t("settings.auditLogs.status.failed") },
    ],
    [t]
  );

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const handleApply = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draftFilters });
  };

  const handleClear = () => {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  const openDetails = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await getAuditLog(id));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : t("settings.auditLogs.errors.detail"));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <div
      className="audit-log-page settings-compact"
      dir={isRtl ? "rtl" : "ltr"}
      data-testid="audit-logs-page"
    >
      <PageHeader
        actions={(
          <Button
            disabled={loading}
            loading={loading}
            loadingLabel={t("common.messages.loading")}
            onClick={() => setRefreshKey((value) => value + 1)}
            size="sm"
            startIcon={<IconRefresh className="h-4 w-4" stroke={1.8} />}
            variant="secondary"
          >
            {t("settings.auditLogs.filters.refresh")}
          </Button>
        )}
        description={t("settings.auditLogs.subtitle")}
        eyebrow={<span className="audit-readonly-label"><IconShieldCheck className="h-3.5 w-3.5" stroke={1.9} />{t("settings.auditLogs.readOnly")}</span>}
        icon={<IconHistory className="h-5 w-5" stroke={1.8} />}
        title={t("settings.auditLogs.title")}
      />

      <div className="audit-summary-grid">
        <SummaryCard icon={<IconActivity className="h-4 w-4" />} label={t("settings.auditLogs.summary.total")} value={formatCount(data.summary.total, i18n.language)} tone="brand" />
        <SummaryCard icon={<IconCheck className="h-4 w-4" />} label={t("settings.auditLogs.summary.successful")} value={formatCount(data.summary.successful, i18n.language)} tone="success" />
        <SummaryCard icon={<IconAlertTriangle className="h-4 w-4" />} label={t("settings.auditLogs.summary.failed")} value={formatCount(data.summary.failed, i18n.language)} tone="danger" />
      </div>

      <form onSubmit={handleApply} className="theme-panel rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <IconFilter className="h-4 w-4 text-brand-400" stroke={1.8} />
            {t("settings.auditLogs.filters.title")}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label={t("settings.auditLogs.filters.search")} className="md:col-span-2">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" stroke={1.8} />
              <input
                type="search"
                className="form-input !ps-9"
                data-testid="audit-logs-search"
                value={draftFilters.search}
                placeholder={t("settings.auditLogs.filters.search")}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.actor")}>
            <DropdownSelect
              value={draftFilters.actorId}
              options={actorOptions}
              onChange={(actorId) => setDraftFilters((current) => ({ ...current, actorId }))}
              buttonClassName="form-input"
              searchable
              disabled={optionsLoading}
            />
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.result")}>
            <DropdownSelect
              value={draftFilters.result}
              options={resultOptions}
              onChange={(result) => setDraftFilters((current) => ({ ...current, result: result as ResultFilter }))}
              buttonClassName="form-input"
            />
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.action")}>
            <DropdownSelect
              value={draftFilters.action}
              options={actionOptions}
              onChange={(action) => setDraftFilters((current) => ({ ...current, action }))}
              buttonClassName="form-input"
              searchable
              disabled={optionsLoading}
            />
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.target")}>
            <DropdownSelect
              value={draftFilters.targetType}
              options={targetOptions}
              onChange={(targetType) => setDraftFilters((current) => ({ ...current, targetType }))}
              buttonClassName="form-input"
              disabled={optionsLoading}
            />
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.from")}>
            <ShamsiDateInput
              locale={i18n.language}
              value={draftFilters.from}
              onChange={(from) => setDraftFilters((current) => ({ ...current, from }))}
              inputClassName="form-input"
              containerClassName="w-full"
            />
          </FilterField>
          <FilterField label={t("settings.auditLogs.filters.to")}>
            <ShamsiDateInput
              locale={i18n.language}
              value={draftFilters.to}
              onChange={(to) => setDraftFilters((current) => ({ ...current, to }))}
              inputClassName="form-input"
              containerClassName="w-full"
            />
          </FilterField>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" onClick={handleClear} data-testid="audit-logs-clear" size="sm" variant="ghost">
            {t("settings.auditLogs.filters.clear")}
          </Button>
          <Button type="submit" disabled={loading} data-testid="audit-logs-apply" size="sm" startIcon={<IconFilter className="h-3.5 w-3.5" stroke={1.8} />} variant="primary">
            {t("settings.auditLogs.filters.apply")}
          </Button>
        </div>
      </form>

      <section className="theme-panel rounded-2xl border p-3 sm:p-4">
        {error ? (
          <ErrorState
            action={<Button onClick={() => setRefreshKey((value) => value + 1)} size="sm" variant="secondary">{t("settings.auditLogs.filters.refresh")}</Button>}
            data-testid="audit-logs-error"
            icon={<IconAlertTriangle className="h-4 w-4" stroke={1.8} />}
            title={error}
          />
        ) : null}

        <DataTableShell className={error ? "mt-3" : undefined}>
          <DataTable variant="compact" minWidth="880px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("settings.auditLogs.table.time")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("settings.auditLogs.table.actor")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("settings.auditLogs.table.action")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("settings.auditLogs.table.target")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("settings.auditLogs.table.result")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("settings.auditLogs.table.details")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableSkeletonRows rows={7} columns={6} />
              ) : data.items.length === 0 ? (
                <DataTableEmptyRow colSpan={6}>{t("settings.auditLogs.table.empty")}</DataTableEmptyRow>
              ) : (
                data.items.map((item) => (
                  <AuditTableRow
                    key={item.id}
                    item={item}
                    locale={i18n.language}
                    t={t}
                    onOpen={() => void openDetails(item.id)}
                  />
                ))
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>

        <PaginationControls
          compact
          className="mt-3"
          page={page}
          pageSize={data.pageSize}
          totalItems={data.total}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={loading}
          showFirstLast
        />
      </section>

      {selectedId ? (
        <AuditDetailModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          locale={i18n.language}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
}

function AuditTableRow({
  item,
  locale,
  t,
  onOpen,
}: {
  item: AuditLogItem;
  locale: string;
  t: TFunction;
  onOpen: () => void;
}) {
  return (
    <DataTableRow clickable onClick={onOpen} data-testid={`audit-log-row-${item.id}`}>
      <DataTableCell>
        <div className="audit-table-primary">{formatDateTime(item.createdAt, locale)}</div>
        <div className="audit-table-secondary" dir="ltr">{shortIdentifier(item.id)}</div>
      </DataTableCell>
      <DataTableCell>
        <div className="audit-table-primary">{formatActor(item, t)}</div>
        <div className="audit-table-secondary">{item.actorRole ? formatRole(item.actorRole, t) : formatActorType(item.actorType, t)}</div>
      </DataTableCell>
      <DataTableCell>
        <div className="audit-table-primary">{formatAction(item.action, t)}</div>
        <code className="audit-action-code" dir="ltr">{item.action}</code>
      </DataTableCell>
      <DataTableCell>
        <div className="audit-table-primary">{item.targetType ? formatTargetType(item.targetType, t) : t("settings.auditLogs.table.noTarget")}</div>
        {item.targetId ? <div className="audit-table-secondary" dir="ltr">{shortIdentifier(item.targetId)}</div> : null}
      </DataTableCell>
      <DataTableCell>
        <AuditStatusBadge success={item.success} t={t} />
      </DataTableCell>
      <DataTableCell align="end">
        <Button
          data-testid={`audit-log-view-${item.id}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          size="sm"
          startIcon={<IconEye className="h-3.5 w-3.5" stroke={1.8} />}
          variant="ghost"
        >
          {t("settings.auditLogs.table.view")}
        </Button>
      </DataTableCell>
    </DataTableRow>
  );
}

function AuditDetailModal({
  detail,
  loading,
  error,
  locale,
  onClose,
}: {
  detail: AuditLogDetail | null;
  loading: boolean;
  error: string | null;
  locale: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useModalDismiss(onClose, true);

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6"
      onClick={onClose}
      data-testid="audit-log-detail-modal"
    >
      <div
        className="audit-detail-modal theme-panel max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="audit-log-page__hero-icon" aria-hidden="true">
              <IconHistory className="h-5 w-5" stroke={1.8} />
            </span>
            <div>
              <h2 id="audit-detail-title" className="text-base font-bold text-[var(--text-primary)]">{t("settings.auditLogs.modal.title")}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("settings.auditLogs.modal.subtitle")}</p>
            </div>
          </div>
          <CloseIconButton label={t("settings.auditLogs.modal.close")} onClick={onClose} />
        </header>

        <div className="max-h-[calc(92vh-86px)] overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="audit-modal-state">{t("settings.auditLogs.modal.loading")}</div>
          ) : error ? (
            <div className="audit-error-banner">
              <IconAlertTriangle className="h-4 w-4" stroke={1.8} />
              {error}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailField label={t("settings.auditLogs.modal.actor")} value={formatActor(detail, t)} />
                <DetailField label={t("settings.auditLogs.modal.actorType")} value={formatActorType(detail.actorType, t)} />
                <DetailField label={t("settings.auditLogs.modal.role")} value={detail.actorRole ? formatRole(detail.actorRole, t) : t("settings.auditLogs.modal.none")} />
                <DetailField label={t("settings.auditLogs.modal.time")} value={formatDateTime(detail.createdAt, locale)} />
                <DetailField label={t("settings.auditLogs.modal.action")} value={formatAction(detail.action, t)} code={detail.action} />
                <DetailField label={t("settings.auditLogs.modal.target")} value={formatTarget(detail, t)} code={detail.targetId ?? undefined} />
                <DetailField label={t("settings.auditLogs.modal.result")} value={<AuditStatusBadge success={detail.success} t={t} />} />
                <DetailField label={t("settings.auditLogs.modal.ipAddress")} value={detail.ipAddress ?? t("settings.auditLogs.modal.none")} code={detail.ipAddress ?? undefined} />
                <DetailField label={t("settings.auditLogs.modal.userAgent")} value={detail.userAgent ?? t("settings.auditLogs.modal.none")} wide />
                <DetailField label={t("settings.auditLogs.modal.sessionId")} value={detail.sessionId ?? t("settings.auditLogs.modal.none")} code={detail.sessionId ?? undefined} />
                <DetailField label={t("settings.auditLogs.modal.requestId")} value={detail.requestId ?? t("settings.auditLogs.modal.none")} code={detail.requestId ?? undefined} />
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <JsonPanel label={t("settings.auditLogs.modal.before")} value={detail.beforeData} emptyLabel={t("settings.auditLogs.modal.noJson")} />
                <JsonPanel label={t("settings.auditLogs.modal.after")} value={detail.afterData} emptyLabel={t("settings.auditLogs.modal.noJson")} />
                <JsonPanel label={t("settings.auditLogs.modal.metadata")} value={detail.metadata} emptyLabel={t("settings.auditLogs.modal.noJson")} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterField({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function AuditStatusBadge({ success, t }: { success: boolean; t: TFunction }) {
  return <AppStatusBadge tone={success ? "success" : "danger"}>{success ? t("settings.auditLogs.status.success") : t("settings.auditLogs.status.failed")}</AppStatusBadge>;
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(resolveDateLocale(locale)).format(value);
}

function DetailField({
  label,
  value,
  code,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  code?: string;
  wide?: boolean;
}) {
  return (
    <div className={`audit-detail-field ${wide ? "sm:col-span-2" : ""}`}>
      <div className="audit-detail-field__label">{label}</div>
      <div className="audit-detail-field__value">{value}</div>
      {code && code !== value ? <code className="audit-detail-field__code" dir="ltr">{code}</code> : null}
    </div>
  );
}

function JsonPanel({ label, value, emptyLabel }: { label: string; value: unknown; emptyLabel: string }) {
  const hasValue = value !== null && typeof value !== "undefined";
  return (
    <section className="audit-json-panel">
      <h3 className="audit-json-panel__title">{label}</h3>
      {hasValue ? (
        <pre className="audit-json-panel__content" dir="ltr">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <p className="audit-json-panel__empty">{emptyLabel}</p>
      )}
    </section>
  );
}

function formatActor(item: Pick<AuditLogItem, "actor" | "actorType" | "actorId">, t: TFunction) {
  if (item.actor) return item.actor.fullName?.trim() || item.actor.username;
  if (item.actorType === "SYSTEM") return t("settings.auditLogs.table.system");
  if (item.actorId) return t("settings.auditLogs.table.removedActor");
  return formatActorType(item.actorType, t);
}

function formatActorType(actorType: AuditLogItem["actorType"], t: TFunction) {
  return t(`settings.auditLogs.actorTypes.${actorType}`, { defaultValue: humanizeToken(actorType) });
}

function formatRole(role: AdminRole, t: TFunction) {
  return t(`settings.auditLogs.roles.${role}`, { defaultValue: humanizeToken(role) });
}

function formatAction(action: string, t: TFunction) {
  return action
    .split(".")
    .filter(Boolean)
    .map((token) => t(`settings.auditLogs.tokens.${token}`, { defaultValue: humanizeToken(token) }))
    .join(" · ");
}

function formatTargetType(targetType: string, t: TFunction) {
  return t(`settings.auditLogs.targetTypes.${targetType}`, { defaultValue: humanizeToken(targetType) });
}

function formatTarget(item: Pick<AuditLogItem, "targetType" | "targetId">, t: TFunction) {
  if (!item.targetType && !item.targetId) return t("settings.auditLogs.table.noTarget");
  return item.targetType ? formatTargetType(item.targetType, t) : item.targetId ?? t("settings.auditLogs.table.noTarget");
}

function humanizeToken(value: string) {
  return value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/^./u, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function shortIdentifier(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
