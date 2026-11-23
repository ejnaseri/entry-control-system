import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref, type SVGProps } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelMemberMembership,
  createMemberMembership,
  createMemberPayment,
  getMember,
  getMemberFull,
  getMembers,
  type Member,
} from "../../api/members";
import { listPlans } from "../../api/membershipPlans";
import {
  createPayrollPayment,
  getPayrollOutstanding,
  getPayrollSummary,
  type PayrollOutstandingItem,
  type PayrollOutstandingResponse,
  type PayrollSummary,
} from "../../api/payroll";
import type { MembershipPlanDTO } from "../../shared/membershipTypes";
import type { FullMemberProfile } from "../../shared/memberTypes";
import { resolveDateLocale } from "../../shared/dateLocale";
import { localDateTimeInputToIso } from "../../shared/dateInputValue";
import { rtlLanguages } from "../../i18n/config";
import { useToast, type ToastPayload } from "../../components/ToastContext";
import { CloseIconButton } from "../../components/CloseIconButton";
import { MemberStatusBadge } from "../../components/members/MemberStatusBadge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { LocalizedDateTimeInput } from "../../components/ui/LocalizedDateTimeInput";
import { LocalizedMonthInput } from "../../components/ui/LocalizedMonthInput";
import { useAuth } from "../../auth/AuthContext";

const CARD_CLASS =
  "rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100";
const INPUT_CLASS =
  "form-input h-9 rounded-lg border border-slate-200 bg-white/90 px-3 text-[11px] text-slate-900 placeholder:text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500";
const TEXTAREA_CLASS =
  "form-input min-h-[52px] resize-none rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] text-slate-900 placeholder:text-slate-400 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500";
const LABEL_CLASS = "text-xs font-semibold text-slate-600 dark:text-slate-300";

type PaymentStatus = "PAID" | "PARTIAL" | "UNPAID";
type CustomerSuccessDetails = {
  memberId: string;
  memberName: string;
  planName: string;
  paidAmount: number;
  paidAt: string | null;
  remaining: number | null;
};
type PayrollSuccessDetails = {
  memberId: string;
  memberName: string;
  monthLabel: string;
  paidAmount: number;
  paidAt: string | null;
  remaining: number | null;
};
type MembershipHistoryRow = {
  id: string;
  planName: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  totalDue: number;
  totalPaid: number;
  remaining: number;
};

function PaymentsPageShell({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  return (
    <div className="payments-page space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t("paymentsPage.title")}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("paymentsPage.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export function MembershipPaymentsPage() {
  const { push } = useToast();
  return (
    <PaymentsPageShell>
      <CustomerPaymentsTab onDirtyChange={() => undefined} onToast={push} />
    </PaymentsPageShell>
  );
}

export function PayrollPaymentsPage() {
  const { push } = useToast();
  return (
    <PaymentsPageShell>
      <PayrollTab onDirtyChange={() => undefined} onToast={push} />
    </PaymentsPageShell>
  );
}

export function Payments() {
  return <MembershipPaymentsPage />;
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-slate-900 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-100">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xs text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function CompactStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "rose" | "sky";
}) {
  const toneClass =
    tone === "rose"
      ? "border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
      : tone === "sky"
        ? "border-sky-200/80 bg-sky-50/80 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"
        : "border-slate-200/80 bg-white/80 text-slate-900 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-100";

  return (
    <div className={`rounded-xl border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

type SelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

function FilterSelectMenu({
  value,
  options,
  onChange,
  buttonClassName = "",
  containerClassName = "",
  buttonRef,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  buttonClassName?: string;
  containerClassName?: string;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const fallbackLabel = value || options[0]?.label || "";
  const displayLabel = selectedOption?.label ?? fallbackLabel;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        type="button"
        ref={buttonRef}
        className={`${buttonClassName} flex w-full items-center justify-between gap-2 text-start hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60`}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 text-slate-500/90 transition dark:text-slate-300/90 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="submenu-panel absolute z-50 mt-1 w-full overflow-hidden rounded-xl border backdrop-blur">
          <div role="listbox" className="max-h-56 overflow-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const optionKey = option.value === "" ? "all" : option.value;
              return (
                <button
                  key={optionKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <CheckIcon className="submenu-check h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberSelectModal({
  open,
  title,
  placeholder,
  query,
  members,
  loading,
  onQueryChange,
  onSelect,
  onClose,
  inputRef,
  emptyLabel,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  query: string;
  members: Member[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (member: Member) => void;
  onClose: () => void;
  inputRef?: Ref<HTMLInputElement>;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/6 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{placeholder}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} size="sm" onClick={onClose} />
        </div>

        <div className="mt-3 space-y-3">
          <input
            type="search"
            data-testid="payments-member-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className={INPUT_CLASS}
            ref={inputRef}
          />
          {loading ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">...</p>
          ) : members.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{emptyLabel}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  data-testid={`payments-member-${member.id}`}
                  onClick={() => onSelect(member)}
                  className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-start text-[11px] text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{formatMemberName(member)}</p>
                      {member.customTitle || member.roleType ? (
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{member.customTitle ?? member.roleType}</p>
                      ) : null}
                    </div>
                    <MemberStatusBadge status={member.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>#{member.code}</span>
                    {member.phone ? <span>{member.phone}</span> : null}
                    {member.email ? <span className="truncate">{member.email}</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/6 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xl shadow-slate-900/20 dark:border-slate-800/70 dark:bg-slate-950 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-amber-400/40 bg-amber-100/80 p-2 text-amber-700 shadow-inner dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
            <WarningIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-700 shadow-sm transition hover:-translate-y-[1px] hover:bg-rose-500/20 hover:text-rose-800 hover:shadow-md dark:border-rose-400/50 dark:text-rose-200 dark:hover:bg-rose-500/20 dark:hover:text-rose-100"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatStatusLabel(status: PaymentStatus, t: (key: string) => string) {
  if (status === "PAID") return t("paymentsPage.status.paid");
  if (status === "PARTIAL") return t("paymentsPage.status.partial");
  return t("paymentsPage.status.unpaid");
}

function getPayrollStatusStyle(status: PaymentStatus) {
  if (status === "PAID") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200";
  }
  if (status === "PARTIAL") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200";
}

function formatMembershipStatusLabel(status: string | null | undefined, t: (key: string) => string) {
  if (!status) return t("paymentsPage.labels.noMembership");
  if (status === "ACTIVE") return t("paymentsPage.membershipStatus.active");
  if (status === "PENDING") return t("paymentsPage.membershipStatus.pending");
  if (status === "EXPIRED") return t("paymentsPage.membershipStatus.expired");
  if (status === "CANCELLED") return t("paymentsPage.membershipStatus.cancelled");
  if (status === "DEBTOR") return t("paymentsPage.membershipStatus.debtor");
  return status;
}

function getMembershipStatusStyle(status?: string | null) {
  if (status === "ACTIVE") {
    return { dataStatus: "ACTIVE", className: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" };
  }
  if (status === "DEBTOR") {
    return { dataStatus: "DEBTOR", className: "bg-rose-500/15 text-rose-200 border-rose-400/30" };
  }
  if (status === "PENDING" || status === "EXPIRED") {
    return { dataStatus: "EXPIRED", className: "bg-amber-500/15 text-amber-200 border-amber-400/30" };
  }
  if (status === "CANCELLED") {
    return { dataStatus: "BLOCKED", className: "bg-slate-600/10 text-slate-200 border-slate-500/40" };
  }
  return { dataStatus: "BLOCKED", className: "bg-slate-600/10 text-slate-200 border-slate-500/40" };
}

function formatMemberName(member: { firstName: string; lastName?: string | null }) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ");
}

function MembershipHistoryModal({
  open,
  onClose,
  rows,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  rows: MembershipHistoryRow[];
  locale: string;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.customers.settledHistoryTitle")}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.settledHistorySubtitle")}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} size="sm" onClick={onClose} />
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.settledHistoryEmpty")}</p>
        ) : (
          <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {rows.map((membership) => (
              <div
                key={membership.id}
                className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-[11px] text-slate-800 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">{membership.planName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t("paymentsPage.customers.startDate")}: {formatDate(membership.startDate, locale)} | {t("paymentsPage.customers.endDate")}: {formatDate(membership.endDate, locale)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t("paymentsPage.customers.membershipAgeLabel")}: {formatElapsedLabel(membership.endDate || membership.startDate, t)}
                    </p>
                  </div>
                  <span
                    className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getMembershipStatusStyle(membership.status).className}`}
                    data-status={getMembershipStatusStyle(membership.status).dataStatus}
                  >
                    {formatMembershipStatusLabel(membership.status, t)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-[10px] text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400">{t("paymentsPage.customers.planAmountLabel")}</span>
                    <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.totalDue, locale)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400">{t("paymentsPage.customers.paidLabel")}</span>
                    <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.totalPaid, locale)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400">{t("paymentsPage.customers.remainingLabel")}</span>
                    <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.remaining, locale)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayrollHistoryModal({
  open,
  onClose,
  payments,
  locale,
  memberName,
  monthLabel,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  payments: PayrollSummary["payments"];
  locale: string;
  memberName: string;
  monthLabel: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/6 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.payroll.historyPayments")}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t("paymentsPage.payroll.memberLabel")}: {memberName} | {t("paymentsPage.payroll.monthLabel")}: {monthLabel}
            </p>
          </div>
          <CloseIconButton label={t("common.actions.close")} size="sm" onClick={onClose} />
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("common.messages.loading")}</p>
        ) : payments.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.payroll.emptyPayments")}</p>
        ) : (
          <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
            <DataTableShell>
              <DataTable variant="compact" minWidth="520px">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("paymentsPage.tables.payrollPayments.date")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("paymentsPage.tables.payrollPayments.amount")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("paymentsPage.tables.payrollPayments.status")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("paymentsPage.tables.payrollPayments.notes")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                {payments.map((payment) => (
                  <DataTableRow key={payment.id}>
                    <DataTableCell className="text-[11px] text-slate-700 dark:text-slate-200">
                      {formatDateTime(payment.paidAt ?? payment.createdAt, locale)}
                    </DataTableCell>
                    <DataTableCell className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatAmount(payment.amount, locale)}
                    </DataTableCell>
                    <DataTableCell>
                      <span className="rounded-full border border-slate-200/70 bg-white/80 px-2 py-0.5 text-[10px] uppercase text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
                        {payment.status || "-"}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-[10px] text-slate-500 dark:text-slate-400">
                      {payment.notes?.trim() ? payment.notes : "-"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
                </DataTableBody>
              </DataTable>
            </DataTableShell>
          </div>
        )}
      </div>
    </div>
  );
}

type MemberLabelSource = {
  id: string;
  code: string;
  firstName: string;
  lastName?: string | null;
  fatherName?: string | null;
  phone?: string | null;
  email?: string | null;
};

function buildMemberLabel(member: MemberLabelSource) {
  const base = `${formatMemberName(member)} - #${member.code}`;
  return member.phone ? `${base} | ${member.phone}` : base;
}

function buildMemberSearchText(member: MemberLabelSource) {
  return [member.id, member.code, member.firstName, member.lastName, member.fatherName, member.phone, member.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatPlanDuration(plan: MembershipPlanDTO, t: (key: string) => string) {
  const unitKey = plan.durationUnit === "MONTHS" ? "membershipPlans.duration.months" : "membershipPlans.duration.days";
  return `${plan.durationValue} ${t(unitKey)}`;
}

function formatDate(value: Date | string | null | undefined, locale = "en") {
  if (!value) return "-";
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString(resolveDateLocale(locale));
}

function formatDateTime(value: Date | string | null | undefined, locale = "en") {
  if (!value) return "-";
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleString(resolveDateLocale(locale), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatAmount(value: number, locale = "en") {
  const safe = safeNumber(value);
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(safe);
}

function formatElapsedLabel(value: Date | string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string) {
  const date = toDate(value);
  if (!date) return "-";
  const now = new Date();
  const sameMonth = now.getFullYear() === date.getFullYear() && now.getMonth() === date.getMonth();
  if (sameMonth) return t("paymentsPage.elapsed.thisMonth");

  const diffMs = date.getTime() - now.getTime();
  const diffDaysRaw = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
  if (diffDaysRaw < 30) {
    return diffMs >= 0
      ? t("paymentsPage.elapsed.inDays", { count: diffDaysRaw })
      : t("paymentsPage.elapsed.daysAgo", { count: diffDaysRaw });
  }
  const diffMonthsRaw = Math.max(1, Math.round(diffDaysRaw / 30));
  if (diffMonthsRaw < 12) {
    return diffMs >= 0
      ? t("paymentsPage.elapsed.inMonths", { count: diffMonthsRaw })
      : t("paymentsPage.elapsed.monthsAgo", { count: diffMonthsRaw });
  }
  const diffYearsRaw = Math.max(1, Math.round(diffMonthsRaw / 12));
  return diffMs >= 0
    ? t("paymentsPage.elapsed.inYears", { count: diffYearsRaw })
    : t("paymentsPage.elapsed.yearsAgo", { count: diffYearsRaw });
}

function safeNumber(value?: number | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getLatestMembership(memberships: NonNullable<FullMemberProfile["memberships"]>) {
  return memberships
    .slice()
    .sort((a, b) => toTimestamp(b.endDate) - toTimestamp(a.endDate))[0];
}

function toTimestamp(value: Date | string | null | undefined) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function scrollNodeIntoView(node: HTMLElement | null, offset = 16) {
  if (typeof window === "undefined" || !node) return;
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const container = node.closest(".main-surface") as HTMLElement | null;

  if (container) {
    const targetY = node.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
    container.scrollTo({
      top: Math.max(0, targetY),
      behavior: prefersReduced ? "auto" : "smooth",
    });
    return;
  }

  const targetY = node.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({
    top: Math.max(0, targetY),
    behavior: prefersReduced ? "auto" : "smooth",
  });
}

function addPlanDuration(start: Date, durationValue: number, unit: string, periods: number) {
  const total = Math.max(1, durationValue) * Math.max(1, periods);
  if (unit === "DAYS") {
    return addDays(start, total);
  }
  return addMonths(start, total);
}

function toMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function formatMonthLabel(value: string, locale = "en") {
  const parsed = parseMonthInput(value);
  if (!parsed) return value;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return date.toLocaleString(resolveDateLocale(locale), { month: "long", year: "numeric" });
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6l-11 11-5-5" />
    </svg>
  );
}

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2a10 10 0 1 0 10 10" />
    </svg>
  );
}

function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.8 2.7 18.2A1.5 1.5 0 0 0 4 20.5h16a1.5 1.5 0 0 0 1.3-2.3L13.7 4.8a1.5 1.5 0 0 0-2.7 0z" />
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
      <path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17z" />
      <path d="M19 14l.6 1.7L21 16l-1.4.5L19 18l-.6-1.5L17 16l1.4-.3L19 14z" />
    </svg>
  );
}

function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CustomerPaymentsTab({ onDirtyChange, onToast }: { onDirtyChange: (dirty: boolean) => void; onToast: (payload: ToastPayload) => void }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const canWriteMemberships = hasPermission("MEMBERSHIPS_WRITE");
  const canCancelMemberships = hasPermission("MEMBERSHIPS_CANCEL");
  const canRecordPayments = hasPermission("PAYMENTS_RECORD");
  const locale = i18n.language;
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState("");
  const [selectedMemberLabel, setSelectedMemberLabel] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [settledModalOpen, setSettledModalOpen] = useState(false);
  const [profile, setProfile] = useState<FullMemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlanDTO[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [debtTarget, setDebtTarget] = useState<MembershipHistoryRow | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const customerSubmitLabel = t("paymentsPage.customers.submit");
  const debtSubmitLabel = t("paymentsPage.customers.debtSubmit");
  const processingLabel = t("paymentsPage.messages.processing");
  const amountLabel = t("paymentsPage.customers.paidAmount");
  const notesLabel = t("paymentsPage.customers.notes");
  const helperText = t("paymentsPage.payroll.amountHelp");
  const successTitle = t("paymentsPage.messages.membershipSuccess");
  const [successDetails, setSuccessDetails] = useState<CustomerSuccessDetails | null>(null);
  const planButtonRef = useRef<HTMLButtonElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const memberSearchInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const activeToastRef = useRef<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MembershipHistoryRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setPlansError(null);
    listPlans(false)
      .then(({ data }) => {
        if (!active) return;
        setPlans(data.filter((plan) => plan.isActive));
      })
      .catch(() => {
        if (!active) return;
        setPlansError(t("paymentsPage.messages.noPlans"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    setMembersError(null);
    const handle = setTimeout(() => {
      getMembers({
        search: memberQuery.trim() || undefined,
        take: 20,
        memberType: "CUSTOMER",
      })
        .then(({ data }) => {
          if (!active) return;
          setMembers(data.items);
        })
        .catch((err) => {
          if (!active) return;
          setMembersError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
        })
        .finally(() => {
          if (!active) return;
          setMembersLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [memberQuery, t]);

  useEffect(() => {
    if (!memberId) {
      setProfile(null);
      setPlanId("");
      setDebtTarget(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    getMemberFull(memberId)
      .then(({ data }) => {
        if (!active) return;
        setProfile(data);
      })
      .catch((err) => {
        if (!active) return;
        setProfile(null);
        setMembersError(err instanceof Error ? err.message : t("memberDetail.errors.loadFailed"));
      })
      .finally(() => {
        if (!active) return;
        setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, t]);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === planId) ?? null, [plans, planId]);
  const memberships = useMemo(() => (profile?.memberships ? [...profile.memberships] : []), [profile]);
  const latestMembership = useMemo(() => getLatestMembership(memberships), [memberships]);
  const membershipHistory = useMemo<MembershipHistoryRow[]>(() => {
    const rows = memberships.map((membership) => {
      const totalDue = roundCurrency(safeNumber(membership.totalDue ?? membership.basePrice ?? 0));
      const totalPaid = roundCurrency(safeNumber(membership.totalPaid ?? 0));
      const remaining = Math.max(0, roundCurrency(totalDue - totalPaid));
      return {
        id: membership.id,
        planName: membership.plan?.name ?? membership.planId,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        totalDue,
        totalPaid,
        remaining,
      };
    });
    return rows.sort((a, b) => {
      const debtDiff = Number(b.remaining > 0) - Number(a.remaining > 0);
      if (debtDiff !== 0) return debtDiff;
      return toTimestamp(b.endDate) - toTimestamp(a.endDate);
    });
  }, [memberships]);
  const debtHistory = useMemo(() => membershipHistory.filter((row) => row.remaining > 0), [membershipHistory]);
  const settledHistory = useMemo(() => membershipHistory.filter((row) => row.remaining <= 0), [membershipHistory]);
  const activeMembership = useMemo(() => {
    const now = new Date();
    return (
      memberships
        .filter((membership) => {
          const end = toDate(membership.endDate);
          if (!end) return false;
          if (!["ACTIVE", "PENDING"].includes(membership.status)) return false;
          return end >= now;
        })
        .sort((a, b) => toTimestamp(b.endDate) - toTimestamp(a.endDate))[0] ?? null
    );
  }, [memberships]);
  const activeHistoryRow = useMemo(() => {
    if (!activeMembership) return null;
    return membershipHistory.find((row) => row.id === activeMembership.id) ?? null;
  }, [activeMembership, membershipHistory]);
  const hasActiveMembership = Boolean(activeMembership);
  const activeMembershipMessage = `${t("memberDetail.tabs.memberships")} - ${t("common.status.active")}`;
  const historyRows = useMemo(() => {
    const rows = [...debtHistory];
    if (activeHistoryRow && !rows.some((row) => row.id === activeHistoryRow.id)) {
      rows.push(activeHistoryRow);
    }
    return rows;
  }, [activeHistoryRow, debtHistory]);

  useEffect(() => {
    if (profile?.member) {
      setSelectedMemberLabel(buildMemberLabel(profile.member));
    }
  }, [profile]);

  useEffect(() => {
    if (!planId || plans.length === 0) return;
    if (!plans.some((plan) => plan.id === planId)) {
      setPlanId("");
    }
  }, [planId, plans]);

  useEffect(() => {
    if (!profile || !memberships.length) return;
    if (planId) return;
    const candidate = latestMembership?.planId;
    if (candidate) {
      setPlanId(candidate);
    }
  }, [latestMembership, memberships.length, planId, profile]);

  const startDate = useMemo(() => {
    const now = new Date();
    if (!latestMembership) return now;
    const end = toDate(latestMembership.endDate) ?? now;
    return end > now ? end : now;
  }, [latestMembership]);

  const endDate = useMemo(() => {
    if (!selectedPlan) return null;
    return addPlanDuration(startDate, selectedPlan.durationValue, selectedPlan.durationUnit, 1);
  }, [selectedPlan, startDate]);

  const totalDue = useMemo(() => {
    if (!selectedPlan) return 0;
    return roundCurrency(selectedPlan.basePrice);
  }, [selectedPlan]);
  const paymentDue = debtTarget ? debtTarget.remaining : totalDue;
  const displayStartDate = debtTarget ? debtTarget.startDate : startDate;
  const displayEndDate = debtTarget ? debtTarget.endDate : endDate;
  const displayPlanName = debtTarget ? debtTarget.planName : selectedPlan ? selectedPlan.name : t("paymentsPage.customers.planPlaceholder");

  useEffect(() => {
    if (!selectedPlan) {
      if (!debtTarget) {
        setPaidAmount("");
      }
      return;
    }
    if (debtTarget) return;
    setPaidAmount(String(totalDue || ""));
  }, [debtTarget, selectedPlan, totalDue]);

  const customerList = useMemo(() => {
    const list = [...members];
    if (profile?.member && !list.some((item) => item.id === profile.member.id)) {
      list.unshift(profile.member as Member);
    }
    return list;
  }, [members, profile]);

  const filteredCustomerList = useMemo(() => {
    const trimmed = memberQuery.trim().toLowerCase();
    if (!trimmed) return customerList;
    return customerList.filter((member) => buildMemberSearchText(member).includes(trimmed));
  }, [customerList, memberQuery]);

  const outstandingBalance = profile?.aggregates.outstandingBalance ?? 0;
  const hasOutstanding = outstandingBalance > 0;

  const planOptions = useMemo<SelectOption[]>(() => {
    const options = plans.map((plan) => ({
      value: plan.id,
      label: `${plan.name} - ${formatPlanDuration(plan, t)}`,
    }));
    return [{ value: "", label: t("paymentsPage.customers.planPlaceholder") }, ...options];
  }, [plans, t]);

  const isDirty = useMemo(
    () => Boolean(memberId && (paidAmount.trim() !== "" || paidAt || notes.trim())),
    [memberId, notes, paidAmount, paidAt]
  );

  useEffect(() => {
    if (memberId && !paidAt) {
      setPaidAt(toDateTimeLocalValue(new Date()));
    }
  }, [memberId, paidAt]);

  const paidNowValue = paidAmount === "" ? 0 : Number(paidAmount);
  const paidNowSafe = Number.isFinite(paidNowValue) ? paidNowValue : 0;
  const remainingNow = Math.max(0, roundCurrency(paymentDue - paidNowSafe));

  useEffect(() => {
    if (membersError) {
      onToast({ kind: "error", title: membersError });
    }
  }, [membersError, onToast]);

  useEffect(() => {
    if (plansError) {
      onToast({ kind: "error", title: plansError });
    }
  }, [plansError, onToast]);

  useEffect(() => {
    if (submitError) {
      onToast({ kind: "error", title: submitError });
    }
  }, [submitError, onToast]);

  useEffect(() => {
    if (submitSuccess && successDetails) {
      const message = [successDetails.memberName, successDetails.planName, formatAmount(successDetails.paidAmount, locale)]
        .filter(Boolean)
        .join(" | ");
      onToast({ kind: "success", title: submitSuccess, message });
    }
  }, [submitSuccess, successDetails, locale, onToast]);

  useEffect(() => {
    const activeId = activeMembership?.id ?? null;
    if (!activeId || activeId === activeToastRef.current) return;
    activeToastRef.current = activeId;
    const title = `${t("memberDetail.tabs.memberships")} - ${t("common.status.active")}`;
    const message = `${t("paymentsPage.customers.endDate")}: ${formatDate(activeMembership?.endDate, locale)}`;
    onToast({ kind: "warning", title, message });
  }, [activeMembership, locale, onToast, t]);

  useEffect(() => {
    if (!memberModalOpen) return;
    const handle = setTimeout(() => {
      memberSearchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(handle);
  }, [memberModalOpen]);

  useEffect(() => {
    if (!memberId) return;
    const handle = requestAnimationFrame(() => {
      scrollNodeIntoView(formRef.current);
    });
    return () => cancelAnimationFrame(handle);
  }, [memberId]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const resetCustomerState = (options?: { keepMember?: boolean; keepSuccess?: boolean }) => {
    const keepMember = options?.keepMember ?? false;
    const keepSuccess = options?.keepSuccess ?? false;
    setPaidAmount("");
    setPaidAt("");
    setNotes("");
    setDebtTarget(null);
    setSubmitError(null);
    if (!keepSuccess) {
      setSubmitSuccess(null);
      setSuccessDetails(null);
    }
    if (!keepMember) {
      setMemberId("");
      setSelectedMemberLabel("");
      setProfile(null);
      setPlanId("");
    }
  };

  const clearSuccess = () => {
    if (submitSuccess || successDetails) {
      setSubmitSuccess(null);
      setSuccessDetails(null);
    }
  };

  const handleMemberQueryChange = (value: string) => {
    clearSuccess();
    setMemberQuery(value);
  };

  const selectMember = (nextMemberId: string, label: string) => {
    const isChanging = memberId && nextMemberId !== memberId;
    if (isChanging) {
      resetCustomerState();
    }
    clearSuccess();
    setMemberId(nextMemberId);
    setSelectedMemberLabel(label);
    setMemberQuery("");
    setMemberModalOpen(false);
    requestAnimationFrame(() => {
      scrollNodeIntoView(formRef.current);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (debtTarget ? !canRecordPayments : !canWriteMemberships) return;
    if (submitting) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    setSuccessDetails(null);

    if (!memberId) {
      setSubmitError(t("paymentsPage.messages.selectMember"));
      return;
    }
    if (debtTarget) {
      const amount = paidAmount === "" ? 0 : Number(paidAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setSubmitError(t("paymentsPage.messages.invalidAmount"));
        return;
      }
      if (amount > debtTarget.remaining) {
        setSubmitError(t("paymentsPage.messages.amountTooHigh"));
        return;
      }

      let paidAtValue: string | undefined;
      if (paidAt) {
        const paidAtIso = localDateTimeInputToIso(paidAt);
        if (!paidAtIso) {
          setSubmitError(t("paymentsPage.messages.invalidDate"));
          return;
        }
        paidAtValue = paidAtIso;
      }

      const trimmedNotes = notes.trim();
      setSubmitting(true);
      try {
        const resolvedPaidAt = paidAtValue ?? new Date().toISOString();
        await createMemberPayment(memberId, {
          amount,
          membershipId: debtTarget.id,
          ...(paidAtValue ? { paidAt: paidAtValue } : {}),
          ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        });
        const refreshed = await getMemberFull(memberId);
        setProfile(refreshed.data);
        setSuccessDetails({
          memberId,
          memberName: profile ? formatMemberName(profile.member) : selectedMemberLabel || memberQuery,
          planName: `${debtTarget.planName} (${t("common.labels.debt")})`,
          paidAmount: amount,
          paidAt: resolvedPaidAt,
          remaining: Math.max(0, roundCurrency(debtTarget.remaining - amount)),
        });
        setSubmitSuccess(t("paymentsPage.messages.debtSuccess"));
        resetCustomerState({ keepMember: true, keepSuccess: true });
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t("paymentsPage.messages.debtFailed"));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (hasActiveMembership) {
      setSubmitError(activeMembershipMessage);
      return;
    }
    if (!selectedPlan) {
      setSubmitError(plansError || t("paymentsPage.messages.selectPlan"));
      return;
    }

    const amount = paidAmount === "" ? 0 : Number(paidAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setSubmitError(t("paymentsPage.messages.invalidAmount"));
      return;
    }

    let paidAtValue: string | undefined;
    if (amount > 0 && paidAt) {
      const paidAtIso = localDateTimeInputToIso(paidAt);
      if (!paidAtIso) {
        setSubmitError(t("paymentsPage.messages.invalidDate"));
        return;
      }
      paidAtValue = paidAtIso;
    }

    const trimmedNotes = notes.trim();
    setSubmitting(true);
    try {
      const resolvedPaidAt = amount > 0 ? (paidAtValue ?? new Date().toISOString()) : null;
      const remaining = selectedPlan ? Math.max(0, roundCurrency(totalDue - amount)) : null;
      await createMemberMembership(memberId, {
        planId: selectedPlan.id,
        ...(amount > 0 ? { paidAmount: amount } : {}),
        ...(paidAtValue ? { paidAt: paidAtValue } : {}),
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      });
      const refreshed = await getMemberFull(memberId);
      setProfile(refreshed.data);
      setSuccessDetails({
        memberId,
        memberName: profile ? formatMemberName(profile.member) : selectedMemberLabel || memberQuery,
        planName: selectedPlan.name,
        paidAmount: amount,
        paidAt: resolvedPaidAt,
        remaining,
      });
      setSubmitSuccess(successTitle);
      resetCustomerState({ keepMember: true, keepSuccess: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("memberDetail.errors.paymentFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMembershipConfirm = async () => {
    if (!canCancelMemberships || !memberId || !cancelTarget || cancelSubmitting) return;
    setCancelSubmitting(true);
    setSubmitError(null);
    try {
      const result = await cancelMemberMembership(memberId, cancelTarget.id);
      const refundedAmountRaw = Number((result.data as { refundedAmount?: number }).refundedAmount ?? cancelTarget.totalPaid);
      const refundedAmount = Number.isFinite(refundedAmountRaw) ? refundedAmountRaw : cancelTarget.totalPaid;
      const refreshed = await getMemberFull(memberId);
      setProfile(refreshed.data);
      setDebtTarget((prev) => (prev?.id === cancelTarget.id ? null : prev));
      setCancelTarget(null);
      onToast({
        kind: "success",
        title: t("paymentsPage.messages.membershipCancelSuccess"),
        message: `${cancelTarget.planName} | ${formatAmount(refundedAmount, locale)}`,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("paymentsPage.messages.membershipCancelFailed"));
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <MemberSelectModal
        open={memberModalOpen}
        title={t("paymentsPage.customers.memberLabel")}
        placeholder={t("paymentsPage.customers.memberPlaceholder")}
        query={memberQuery}
        members={filteredCustomerList}
        loading={membersLoading}
        onQueryChange={handleMemberQueryChange}
        onSelect={(member) => {
          selectMember(member.id, buildMemberLabel(member));
          setTimeout(() => {
            planButtonRef.current?.focus();
          }, 0);
        }}
        onClose={() => setMemberModalOpen(false)}
        inputRef={memberSearchInputRef}
        emptyLabel={t("common.values.none")}
      />
      <MembershipHistoryModal
        open={settledModalOpen}
        onClose={() => setSettledModalOpen(false)}
        rows={settledHistory}
        locale={locale}
      />
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t("paymentsPage.customers.cancelMembershipTitle")}
        description={
          cancelTarget
            ? t("paymentsPage.customers.cancelMembershipConfirm", {
                plan: cancelTarget.planName,
                amount: formatAmount(cancelTarget.totalPaid, locale),
              })
            : ""
        }
        confirmLabel={
          cancelSubmitting ? t("paymentsPage.messages.processing") : t("paymentsPage.customers.cancelMembershipAction")
        }
        cancelLabel={t("common.actions.cancel")}
        onConfirm={handleCancelMembershipConfirm}
        onCancel={() => {
          if (cancelSubmitting) return;
          setCancelTarget(null);
        }}
      />

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        <div className="space-y-4 lg:col-span-2">
          <div className={CARD_CLASS}>
            <div className="grid gap-3 md:grid-cols-2 md:items-start">
              <div className="space-y-2">
                <label className={LABEL_CLASS}>{t("paymentsPage.customers.memberLabel")}</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="payments-customer-member-open"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-start text-[11px] text-slate-800 hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700"
                    onClick={() => setMemberModalOpen(true)}
                    disabled={submitting}
                  >
                    <span className={memberId ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
                      {memberId ? selectedMemberLabel || memberQuery : t("paymentsPage.customers.memberPlaceholder")}
                    </span>
                    <ChevronDownIcon className="h-3.5 w-3.5 text-slate-300/90" />
                  </button>
                  {memberId ? (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-[10px] text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
                      onClick={() => {
                        resetCustomerState();
                        setMemberQuery("");
                      }}
                      disabled={submitting}
                    >
                      {t("common.actions.clear")}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="md:pt-5">
                {!memberId ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.emptyMember")}</p>
                ) : profileLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("common.messages.loading")}</p>
                ) : profile ? (
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-slate-900 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{t("paymentsPage.customers.currentTitle")}</p>
                      {latestMembership?.status ? (
                        <span
                          className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getMembershipStatusStyle(latestMembership.status).className}`}
                          data-status={getMembershipStatusStyle(latestMembership.status).dataStatus}
                        >
                          {formatMembershipStatusLabel(latestMembership.status, t)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>{t("paymentsPage.customers.endDate")}</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {latestMembership ? formatDate(latestMembership.endDate, locale) : "-"}
                        </span>
                      </div>
                      {hasOutstanding ? (
                        <div className="flex items-center justify-between">
                          <span>{t("memberDetail.stats.outstanding")}</span>
                          <span className="text-slate-800 dark:text-slate-200">{formatAmount(outstandingBalance, locale)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {memberId ? (
            <div className={CARD_CLASS}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.customers.historyMemberships")}</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.historySubtitle")}</p>
                </div>
                {settledHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSettledModalOpen(true)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
                    disabled={submitting}
                  >
                    {t("paymentsPage.customers.settledHistoryButton", { count: settledHistory.length })}
                  </button>
                ) : null}
              </div>
              {profileLoading ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.historyLoading")}</p>
              ) : !profile ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.historyUnavailable")}</p>
              ) : historyRows.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.historyEmptyDebt")}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {historyRows.map((membership) => {
                    const hasDebt = membership.remaining > 0;
                    const canCancelMembership =
                      canCancelMemberships && membership.totalPaid > 0 && membership.status !== "CANCELLED";
                    const metaTextClass = hasDebt ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400";
                    const labelTextClass = hasDebt ? "text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400";
                    return (
                      <div
                        key={membership.id}
                        className={`rounded-xl border p-3 text-[11px] ${
                          hasDebt
                            ? "border-amber-400/30 bg-amber-500/15 text-slate-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-slate-100"
                            : "border-slate-200/80 bg-white/80 text-slate-800 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold">{membership.planName}</p>
                            <p className={`text-[10px] ${metaTextClass}`}>
                              {t("paymentsPage.customers.startDate")}: {formatDate(membership.startDate, locale)} | {t("paymentsPage.customers.endDate")}: {formatDate(membership.endDate, locale)}
                            </p>
                            <p className={`text-[10px] ${metaTextClass}`}>
                              {t("paymentsPage.customers.membershipAgeLabel")}: {formatElapsedLabel(membership.endDate || membership.startDate, t)}
                            </p>
                          </div>
                          <span
                            className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getMembershipStatusStyle(membership.status).className}`}
                            data-status={getMembershipStatusStyle(membership.status).dataStatus}
                          >
                            {formatMembershipStatusLabel(membership.status, t)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-[10px] text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                          <div className="flex items-center gap-1.5">
                            <span className={labelTextClass}>{t("paymentsPage.customers.planAmountLabel")}</span>
                            <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.totalDue, locale)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={labelTextClass}>{t("paymentsPage.customers.paidLabel")}</span>
                            <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.totalPaid, locale)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={labelTextClass}>{t("paymentsPage.customers.remainingLabel")}</span>
                            <span className="text-slate-900 dark:text-slate-100">{formatAmount(membership.remaining, locale)}</span>
                          </div>
                        </div>
                        {hasDebt || canCancelMembership ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {hasDebt && canRecordPayments ? (
                              <>
                                <button
                                  type="button"
                                  data-testid={`payments-debt-full-${membership.id}`}
                                  onClick={() => {
                                    clearSuccess();
                                    setDebtTarget(membership);
                                    setPaidAmount(String(membership.remaining));
                                    if (!paidAt) {
                                      setPaidAt(toDateTimeLocalValue(new Date()));
                                    }
                                    setTimeout(() => {
                                      amountInputRef.current?.focus();
                                    }, 0);
                                  }}
                                  className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-900 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100"
                                  disabled={submitting || cancelSubmitting}
                                >
                                  {t("paymentsPage.customers.debtFullPay")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    clearSuccess();
                                    setDebtTarget(membership);
                                    setPaidAmount("");
                                    if (!paidAt) {
                                      setPaidAt(toDateTimeLocalValue(new Date()));
                                    }
                                    setTimeout(() => {
                                      amountInputRef.current?.focus();
                                    }, 0);
                                  }}
                                  className="rounded-full border border-slate-300 px-3 py-1 text-[10px] font-semibold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
                                  disabled={submitting || cancelSubmitting}
                                >
                                  {t("paymentsPage.customers.debtPay")}
                                </button>
                              </>
                            ) : null}
                            {canCancelMembership ? (
                              <button
                                type="button"
                                onClick={() => {
                                  clearSuccess();
                                  setCancelTarget(membership);
                                }}
                                className="rounded-full border border-rose-400/60 bg-rose-500/10 px-3 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-500/20 dark:border-rose-400/50 dark:text-rose-200 dark:hover:bg-rose-500/20"
                                disabled={submitting || cancelSubmitting}
                              >
                                {t("paymentsPage.customers.cancelMembershipAction")}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          <div className={CARD_CLASS}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.customers.nextTitle")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {displayPlanName}
                </p>
              </div>
            </div>
            {debtTarget ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold">{t("paymentsPage.customers.debtBannerTitle")}</p>
                  <p className="text-[10px]">
                    {t("paymentsPage.customers.debtBannerPlan")}: {debtTarget.planName}
                  </p>
                  <p className="text-[10px]">
                    {t("paymentsPage.customers.debtBannerRemaining")}: {formatAmount(debtTarget.remaining, locale)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDebtTarget(null);
                    clearSuccess();
                  }}
                  className="rounded-full border border-amber-300 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:border-amber-400 dark:border-amber-500/40 dark:text-amber-100"
                  disabled={submitting}
                >
                  {t("common.actions.cancel")}
                </button>
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>{t("paymentsPage.customers.planLabel")}</label>
                <FilterSelectMenu
                  value={planId}
                  options={planOptions}
                  onChange={(value) => {
                    clearSuccess();
                    setPlanId(value);
                    setTimeout(() => {
                      amountInputRef.current?.focus();
                    }, 0);
                  }}
                  buttonClassName={INPUT_CLASS}
                  buttonRef={planButtonRef}
                  disabled={plans.length === 0 || submitting || Boolean(debtTarget)}
                />
              </div>
              <SummaryField label={t("paymentsPage.customers.startDate")} value={formatDate(displayStartDate, locale)} />
              <SummaryField label={t("paymentsPage.customers.endDate")} value={displayEndDate ? formatDate(displayEndDate, locale) : "-"} />
              <SummaryField label={t("paymentsPage.customers.totalDue")} value={formatAmount(paymentDue, locale)} />
              <div>
                <label className={LABEL_CLASS}>{amountLabel}</label>
                <input
                  type="number"
                  data-testid="payments-customer-amount"
                  min="0"
                  step="0.01"
                  value={paidAmount}
                  onChange={(event) => {
                    clearSuccess();
                    setPaidAmount(event.target.value);
                  }}
                  className={INPUT_CLASS}
                  placeholder="0"
                  ref={amountInputRef}
                  disabled={submitting || (!selectedPlan && !debtTarget)}
                />
                {helperText ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helperText}</p> : null}
              </div>
              <div>
                <label className={LABEL_CLASS}>{t("paymentsPage.customers.paidAt")}</label>
                <LocalizedDateTimeInput
                  value={paidAt}
                  onChange={(value) => {
                    clearSuccess();
                    setPaidAt(value);
                  }}
                  locale={locale}
                  inputClassName={`${INPUT_CLASS} payments-date-input`}
                  disabled={submitting || (!selectedPlan && !debtTarget)}
                />
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>{notesLabel}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => {
                    clearSuccess();
                    setNotes(event.target.value);
                  }}
                  className={TEXTAREA_CLASS}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100 dark:shadow-inner dark:shadow-slate-950/60 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  {memberId ? profile ? formatMemberName(profile.member) : selectedMemberLabel || memberQuery : t("paymentsPage.customers.memberPlaceholder")}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{memberId && profile ? `#${profile.member.code}` : ""}</p>
              </div>
              <span
                className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getMembershipStatusStyle(latestMembership?.status).className}`}
                data-status={getMembershipStatusStyle(latestMembership?.status).dataStatus}
              >
                {formatMembershipStatusLabel(latestMembership?.status, t)}
              </span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("paymentsPage.customers.totalDue")}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatAmount(paymentDue, locale)}</p>
            </div>
            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>{amountLabel}</span>
                <span className="text-slate-900 dark:text-white">{formatAmount(paidNowSafe, locale)}</span>
              </div>
              <div
                className="member-badge member-badge--status flex items-center justify-between rounded-full border px-2.5 py-1 text-[10px] font-medium bg-emerald-500/15 text-emerald-200 border-emerald-400/30"
                data-status="ACTIVE"
              >
                <span>{t("paymentsPage.customers.remainingLabel")}</span>
                <span className="font-semibold">{formatAmount(remainingNow, locale)}</span>
              </div>
              {profile && hasOutstanding ? (
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>{t("memberDetail.stats.outstanding")}</span>
                  <span className="text-slate-800 dark:text-slate-200">{formatAmount(outstandingBalance, locale)}</span>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>{t("paymentsPage.customers.startDate")}</span>
                <span className="text-slate-800 dark:text-slate-200">{formatDate(displayStartDate, locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("paymentsPage.customers.endDate")}</span>
                <span className="text-slate-800 dark:text-slate-200">{displayEndDate ? formatDate(displayEndDate, locale) : "-"}</span>
              </div>
            </div>
            <button
              type="submit"
              data-testid="payments-customer-submit"
              className="w-full rounded-lg border border-brand-500/50 bg-brand-500/20 px-3 py-2 text-[11px] font-semibold text-slate-900 hover:bg-brand-500/30 disabled:opacity-50 dark:text-white"
              hidden={debtTarget ? !canRecordPayments : !canWriteMemberships}
              disabled={submitting || !memberId || (!debtTarget && (!selectedPlan || hasActiveMembership))}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  {processingLabel}
                </span>
              ) : (
                debtTarget ? debtSubmitLabel : customerSubmitLabel
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function PayrollTab({ onDirtyChange, onToast }: { onDirtyChange: (dirty: boolean) => void; onToast: (payload: ToastPayload) => void }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPayload, setHistoryPayload] = useState<{
    memberName: string;
    monthLabel: string;
    payments: PayrollSummary["payments"];
  } | null>(null);
  const [monthValue, setMonthValue] = useState(() => toMonthInputValue(new Date()));
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<PayrollOutstandingResponse | null>(null);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [memberFallback, setMemberFallback] = useState<Member | null>(null);
  const [memberSnapshot, setMemberSnapshot] = useState<PayrollOutstandingItem["member"] | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const payrollSubmitLabel = t("paymentsPage.payroll.submit");
  const processingLabel = t("paymentsPage.messages.processing");
  const amountLabel = t("paymentsPage.payroll.amountLabel");
  const notesLabel = t("paymentsPage.payroll.notes");
  const helperText = t("paymentsPage.messages.amountHelp");
  const successTitle = t("paymentsPage.messages.payrollSuccess");
  const [successDetails, setSuccessDetails] = useState<PayrollSuccessDetails | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const memberSearchInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const discardActionRef = useRef<null | (() => void)>(null);
  const historyRequestRef = useRef(0);
  const scrollToPayrollForm = () => {
    requestAnimationFrame(() => {
      scrollNodeIntoView(formRef.current);
    });
  };

  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    setMembersError(null);
    const handle = setTimeout(() => {
      getMembers({
        search: memberQuery.trim() || undefined,
        take: 20,
        memberType: "STAFF",
      })
        .then(({ data }) => {
          if (!active) return;
          setMembers(data.items);
        })
        .catch((err) => {
          if (!active) return;
          setMembersError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
        })
        .finally(() => {
          if (!active) return;
          setMembersLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [memberQuery, t]);

  const displayMember = useMemo(() => {
    if (memberFallback && memberFallback.id === memberId) return memberFallback;
    const fromList = members.find((member) => member.id === memberId);
    return fromList ?? memberSnapshot;
  }, [memberFallback, memberId, members, memberSnapshot]);
  const maxMonth = useMemo(() => toMonthInputValue(new Date()), []);

  useEffect(() => {
    if (!memberId) {
      setMemberFallback(null);
      return;
    }
    const found = members.find((member) => member.id === memberId);
    if (found) {
      setMemberFallback(found);
      return;
    }
    let active = true;
    getMember(memberId)
      .then(({ data }) => {
        if (!active) return;
        setMemberFallback(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [memberId, members]);

  useEffect(() => {
    if (!memberId) {
      setSummary(null);
      return;
    }
    if (maxMonth && monthValue > maxMonth) {
      setMonthValue(maxMonth);
    }
  }, [maxMonth, memberId, monthValue]);

  useEffect(() => {
    if (!memberId) {
      setSummary(null);
      setSummaryError(null);
      return;
    }
    const parsed = parseMonthInput(monthValue);
    if (!parsed) return;
    let active = true;
    setSummaryLoading(true);
    setSummaryError(null);
    getPayrollSummary({ memberId, year: parsed.year, month: parsed.month })
      .then(({ data }) => {
        if (!active) return;
        setSummary(data);
      })
      .catch((err) => {
        if (!active) return;
        setSummaryError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
        setSummary(null);
      })
      .finally(() => {
        if (!active) return;
        setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [memberId, monthValue, t]);

  useEffect(() => {
    if (!memberId) {
      setHistoryOpen(false);
      setHistoryLoading(false);
      setHistoryPayload(null);
    }
  }, [memberId]);

  useEffect(() => {
    const parsed = parseMonthInput(monthValue);
    if (!parsed) {
      setOutstanding(null);
      setOutstandingError(null);
      return;
    }
    let active = true;
    setOutstandingLoading(true);
    setOutstandingError(null);
    getPayrollOutstanding({ year: parsed.year, month: parsed.month, take: 50 })
      .then(({ data }) => {
        if (!active) return;
        setOutstanding(data);
      })
      .catch((err) => {
        if (!active) return;
        setOutstandingError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
        setOutstanding(null);
      })
      .finally(() => {
        if (!active) return;
        setOutstandingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [monthValue, t]);

  useEffect(() => {
    if (!summary) {
      setPaidAmount("");
      return;
    }
    if (submitSuccess) return;
    setPaidAmount(summary.balance > 0 ? String(summary.balance) : "");
  }, [summary, submitSuccess]);

  const staffList = useMemo(() => {
    const list = memberFallback && !members.some((member) => member.id === memberFallback.id) ? [memberFallback, ...members] : members;
    const trimmed = memberQuery.trim().toLowerCase();
    if (!trimmed) return list;
    return list.filter((member) => buildMemberSearchText(member).includes(trimmed));
  }, [memberFallback, memberQuery, members]);

  const displayMemberName = displayMember ? formatMemberName(displayMember) : memberQuery;
  const displayMemberCode = displayMember?.code ? `#${displayMember.code}` : "";
  const historyPayments = useMemo(() => {
    if (!summary?.payments) return [];
    return [...summary.payments].sort(
      (a, b) => toTimestamp(b.paidAt ?? b.createdAt) - toTimestamp(a.paidAt ?? a.createdAt)
    );
  }, [summary]);

  const openHistoryModal = (payload: { memberName: string; monthLabel: string; payments: PayrollSummary["payments"] }) => {
    setHistoryPayload(payload);
    setHistoryLoading(false);
    setHistoryOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryPayload(null);
  };

  const isDirty = useMemo(
    () => Boolean(memberId && (paidAmount.trim() !== "" || paidAt || notes.trim())),
    [memberId, notes, paidAmount, paidAt]
  );

  const requestDiscard = (action: () => void) => {
    discardActionRef.current = action;
    setDiscardDialogOpen(true);
  };

  const handleDiscardConfirm = () => {
    const action = discardActionRef.current;
    discardActionRef.current = null;
    setDiscardDialogOpen(false);
    action?.();
  };

  const handleDiscardCancel = () => {
    discardActionRef.current = null;
    setDiscardDialogOpen(false);
  };

  useEffect(() => {
    if (membersError) {
      onToast({ kind: "error", title: membersError });
    }
  }, [membersError, onToast]);

  useEffect(() => {
    if (summaryError) {
      onToast({ kind: "error", title: summaryError });
    }
  }, [summaryError, onToast]);

  useEffect(() => {
    if (outstandingError) {
      onToast({ kind: "error", title: outstandingError });
    }
  }, [outstandingError, onToast]);

  useEffect(() => {
    if (submitError) {
      onToast({ kind: "error", title: submitError });
    }
  }, [submitError, onToast]);

  useEffect(() => {
    if (submitSuccess && successDetails) {
      const message = [successDetails.memberName, successDetails.monthLabel, formatAmount(successDetails.paidAmount, locale)]
        .filter(Boolean)
        .join(" | ");
      onToast({ kind: "success", title: submitSuccess, message });
    }
  }, [submitSuccess, successDetails, locale, onToast]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!memberModalOpen) return;
    const handle = setTimeout(() => {
      memberSearchInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(handle);
  }, [memberModalOpen]);

  useEffect(() => {
    if (!memberId) return;
    const handle = requestAnimationFrame(() => {
      scrollNodeIntoView(formRef.current);
    });
    return () => cancelAnimationFrame(handle);
  }, [memberId]);

  const resetPayrollState = (options?: { keepMember?: boolean; keepSuccess?: boolean }) => {
    const keepMember = options?.keepMember ?? false;
    const keepSuccess = options?.keepSuccess ?? false;
    setPaidAmount("");
    setPaidAt("");
    setNotes("");
    setSubmitError(null);
    if (!keepSuccess) {
      setSubmitSuccess(null);
      setSuccessDetails(null);
    }
    if (!keepMember) {
      setMemberId("");
      setSummary(null);
      setMemberFallback(null);
      setMemberSnapshot(null);
      setHistoryOpen(false);
      setHistoryLoading(false);
      setHistoryPayload(null);
    }
  };

  const clearSuccess = () => {
    if (submitSuccess || successDetails) {
      setSubmitSuccess(null);
      setSuccessDetails(null);
    }
  };

  const handleMemberQueryChange = (value: string) => {
    clearSuccess();
    setMemberQuery(value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!memberId) {
      setSubmitError(t("paymentsPage.messages.selectMember"));
      return;
    }
    const parsed = parseMonthInput(monthValue);
    if (!parsed) {
      setSubmitError(t("paymentsPage.messages.invalidDate"));
      return;
    }
    const amount = paidAmount === "" ? 0 : Number(paidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError(t("paymentsPage.messages.invalidAmount"));
      return;
    }
    if (summary && amount > summary.balance) {
      setSubmitError(t("paymentsPage.messages.amountTooHigh"));
      return;
    }

    let paidAtValue: string | undefined;
    if (paidAt) {
      const paidAtIso = localDateTimeInputToIso(paidAt);
      if (!paidAtIso) {
        setSubmitError(t("paymentsPage.messages.invalidDate"));
        return;
      }
      paidAtValue = paidAtIso;
    }

    setSubmitting(true);
    try {
      const resolvedPaidAt = paidAtValue ?? new Date().toISOString();
      const response = await createPayrollPayment({
        memberId,
        year: parsed.year,
        month: parsed.month,
        amount,
        ...(paidAtValue ? { paidAt: paidAtValue } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setSummary(response.data);
      setSuccessDetails({
        memberId,
        memberName: memberFallback ? formatMemberName(memberFallback) : memberQuery,
        monthLabel: formatMonthLabel(monthValue, locale),
        paidAmount: amount,
        paidAt: resolvedPaidAt,
        remaining: response.data.balance ?? null,
      });
      setSubmitSuccess(successTitle);
      resetPayrollState({ keepMember: true, keepSuccess: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("memberDetail.errors.paymentFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOutstandingSelect = (item: PayrollOutstandingItem) => {
    const applySelection = () => {
      if (item.member.id === memberId) {
        setMemberSnapshot(item.member);
        scrollToPayrollForm();
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 0);
        return;
      }
      resetPayrollState();
      clearSuccess();
      setHistoryOpen(false);
      setHistoryLoading(false);
      setHistoryPayload(null);
      setMemberId(item.member.id);
      setMemberSnapshot(item.member);
      setMemberQuery("");
      setMemberModalOpen(false);
      scrollToPayrollForm();
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 0);
    };
    if (isDirty) {
      requestDiscard(applySelection);
      return;
    }
    applySelection();
  };

  const handleOutstandingHistory = (item: PayrollOutstandingItem) => {
    const parsed = parseMonthInput(monthValue);
    if (!parsed) return;
    const requestId = ++historyRequestRef.current;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryPayload({
      memberName: formatMemberName(item.member),
      monthLabel: formatMonthLabel(monthValue, locale),
      payments: [],
    });
    getPayrollSummary({ memberId: item.member.id, year: parsed.year, month: parsed.month })
      .then(({ data }) => {
        if (historyRequestRef.current !== requestId) return;
        const payments = [...(data.payments ?? [])].sort(
          (a, b) => toTimestamp(b.paidAt ?? b.createdAt) - toTimestamp(a.paidAt ?? a.createdAt)
        );
        setHistoryPayload({
          memberName: formatMemberName(item.member),
          monthLabel: formatMonthLabel(monthValue, locale),
          payments,
        });
      })
      .catch((err) => {
        if (historyRequestRef.current !== requestId) return;
        onToast({ kind: "error", title: err instanceof Error ? err.message : t("members.errors.loadFailed") });
        setHistoryPayload({
          memberName: formatMemberName(item.member),
          monthLabel: formatMonthLabel(monthValue, locale),
          payments: [],
        });
      })
      .finally(() => {
        if (historyRequestRef.current !== requestId) return;
        setHistoryLoading(false);
      });
  };

  return (
    <div className="flex flex-col gap-4">
      <MemberSelectModal
        open={memberModalOpen}
        title={t("paymentsPage.payroll.memberLabel")}
        placeholder={t("paymentsPage.payroll.memberPlaceholder")}
        query={memberQuery}
        members={staffList}
        loading={membersLoading}
        onQueryChange={handleMemberQueryChange}
        onSelect={(member) => {
          const isChanging = memberId && member.id !== memberId;
          const applySelection = () => {
            if (isChanging) {
              resetPayrollState();
            }
            clearSuccess();
            setHistoryOpen(false);
            setMemberId(member.id);
            setMemberFallback(member);
            setMemberSnapshot(null);
            setMemberQuery("");
            setMemberModalOpen(false);
            scrollToPayrollForm();
          };
          if (isChanging && isDirty) {
            requestDiscard(applySelection);
            return;
          }
          applySelection();
        }}
        onClose={() => setMemberModalOpen(false)}
        inputRef={memberSearchInputRef}
        emptyLabel={t("common.values.none")}
      />
      <ConfirmDialog
        open={discardDialogOpen}
        title={t("paymentsPage.messages.discardTitle")}
        description={t("paymentsPage.messages.discardConfirm")}
        confirmLabel={t("paymentsPage.messages.discardAction")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={handleDiscardConfirm}
        onCancel={handleDiscardCancel}
      />
      <PayrollHistoryModal
        open={historyOpen}
        onClose={closeHistoryModal}
        payments={historyPayload?.payments ?? historyPayments}
        locale={locale}
        memberName={historyPayload?.memberName ?? displayMemberName}
        monthLabel={historyPayload?.monthLabel ?? formatMonthLabel(monthValue, locale)}
        loading={historyLoading}
      />
      {memberId ? (
        <form ref={formRef} onSubmit={handleSubmit} className="order-2 space-y-4 lg:grid lg:grid-cols-5 lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:col-span-3">
            <div className={CARD_CLASS}>
              <div className="flex items-center justify-between gap-2">
                <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.payroll.submit")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("paymentsPage.payroll.monthLabel")}:{" "}
                  <span className="text-slate-900 dark:text-slate-100">{formatMonthLabel(monthValue, locale)}</span>
                </p>
                {summary?.availableFrom ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("paymentsPage.payroll.availableFrom", {
                      year: summary.availableFrom.year,
                      month: summary.availableFrom.month,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={LABEL_CLASS}>{amountLabel}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    data-testid="payments-payroll-amount"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(event) => {
                      clearSuccess();
                      setPaidAmount(event.target.value);
                    }}
                    className={INPUT_CLASS}
                    placeholder="0"
                    disabled={!summary || summary.balance <= 0 || submitting}
                    ref={amountInputRef}
                  />
                  <button
                    type="button"
                    className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-300/70 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-800 hover:shadow-md dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400/70 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      if (!summary?.suggestion) return;
                      clearSuccess();
                      setPaidAmount(String(roundCurrency(summary.suggestion.suggestedPay)));
                    }}
                    disabled={!summary?.suggestion || submitting}
                  >
                    <SparkleIcon className="h-3.5 w-3.5" />
                    {t("paymentsPage.payroll.useSuggested")}
                  </button>
                </div>
                {helperText ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helperText}</p> : null}
              </div>
              <div>
                <label className={LABEL_CLASS}>{t("paymentsPage.payroll.paidAt")}</label>
                <LocalizedDateTimeInput
                  value={paidAt}
                  onChange={(value) => {
                    clearSuccess();
                    setPaidAt(value);
                  }}
                  locale={locale}
                  inputClassName={`${INPUT_CLASS} payments-date-input`}
                  disabled={!summary || submitting}
                />
              </div>
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>{notesLabel}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => {
                    clearSuccess();
                    setNotes(event.target.value);
                  }}
                  className={TEXTAREA_CLASS}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
        </div>

        {memberId ? (
          <div className="lg:col-span-2">
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100 dark:shadow-inner dark:shadow-slate-950/60 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{displayMemberName}</p>
                  <p className="text-[10px] text-slate-500">{displayMemberCode}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {summary ? (
                    <span className="rounded-full border border-slate-300 px-2.5 py-1 text-[10px] uppercase text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {formatStatusLabel(summary.status, t)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      openHistoryModal({
                        memberName: displayMemberName,
                        monthLabel: formatMonthLabel(monthValue, locale),
                        payments: historyPayments,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!summary || summaryLoading}
                  >
                    <HistoryIcon className="h-3 w-3" />
                    {t("paymentsPage.payroll.historyPayments")}
                  </button>
                </div>
              </div>
              {summaryLoading ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("common.messages.loading")}</p>
              ) : summary ? (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("paymentsPage.payroll.netPayable")}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatAmount(summary.totalDue, locale)}</p>
                  </div>
                  <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>{t("paymentsPage.payroll.paid")}</span>
                      <span className="text-slate-900 dark:text-white">{formatAmount(summary.paidAmount, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                      <span>{t("paymentsPage.payroll.remaining")}</span>
                      <span className="font-semibold">{formatAmount(summary.balance, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>{t("paymentsPage.payroll.agreedSalary")}</span>
                      <span className="text-slate-800 dark:text-slate-200">{formatAmount(summary.baseAmount, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                      <span>{t("paymentsPage.payroll.adjustments")}</span>
                      <span
                        className={
                          summary.adjustments < 0
                            ? "text-rose-600 dark:text-rose-300"
                            : summary.adjustments > 0
                              ? "text-emerald-700 dark:text-emerald-200"
                              : "text-slate-800 dark:text-slate-200"
                        }
                      >
                        {formatAmount(summary.adjustments, locale)}
                      </span>
                    </div>
                  </div>
                  {summary.suggestion ? (
                    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-2.5 text-[10px] text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("paymentsPage.payroll.suggestionTitle")}
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                        {t("paymentsPage.payroll.suggestedPay")}: {formatAmount(summary.suggestion.suggestedPay, locale)}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <CompactStat
                          label={t("paymentsPage.payroll.monthDays")}
                          value={`${summary.suggestion.monthDays}`}
                        />
                        <CompactStat
                          label={t("paymentsPage.payroll.assessedDays")}
                          value={`${summary.suggestion.assessedDays}`}
                        />
                        <CompactStat
                          label={t("paymentsPage.payroll.expectedWorkDays")}
                          value={`${summary.suggestion.expectedWorkDays}`}
                        />
                        <CompactStat
                          label={t("paymentsPage.payroll.absentDays")}
                          value={`${summary.suggestion.absentDays}`}
                          tone="rose"
                        />
                        <CompactStat
                          label={t("paymentsPage.payroll.leaveDays")}
                          value={`${summary.suggestion.justifiedDays}`}
                          tone="sky"
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span>{t("paymentsPage.payroll.suggestionAbsences", { count: summary.suggestion.absentDays })}</span>
                          <span className="text-slate-900 dark:text-slate-100">
                            {formatAmount(summary.suggestion.items.find((item) => item.type === "ABSENCE")?.amount ?? 0, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("paymentsPage.payroll.suggestionLate", { minutes: summary.suggestion.lateMinutes })}</span>
                          <span className="text-slate-900 dark:text-slate-100">
                            {formatAmount(summary.suggestion.items.find((item) => item.type === "LATE")?.amount ?? 0, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("paymentsPage.payroll.suggestionEarlyLeave", { minutes: summary.suggestion.earlyLeaveMinutes })}</span>
                          <span className="text-slate-900 dark:text-slate-100">
                            {formatAmount(summary.suggestion.items.find((item) => item.type === "EARLY_LEAVE")?.amount ?? 0, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("paymentsPage.payroll.suggestionOvertime", { minutes: summary.suggestion.overtimeMinutes })}</span>
                          <span className="text-emerald-700 dark:text-emerald-200">
                            {formatAmount(summary.suggestion.items.find((item) => item.type === "OVERTIME")?.amount ?? 0, locale)}
                          </span>
                        </div>
                        {summary.suggestion.justifiedDays > 0 ? (
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span>{t("paymentsPage.payroll.suggestionJustified", { count: summary.suggestion.justifiedDays })}</span>
                          </div>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between border-t border-slate-200/70 pt-2 text-[10px] text-slate-600 dark:border-slate-800/70 dark:text-slate-300">
                          <span>{t("paymentsPage.payroll.suggestionNet")}</span>
                          <span
                            className={
                              summary.suggestion.totalAdjustment < 0
                                ? "text-rose-600 dark:text-rose-300"
                                : summary.suggestion.totalAdjustment > 0
                                  ? "text-emerald-700 dark:text-emerald-200"
                                  : "text-slate-900 dark:text-slate-100"
                            }
                          >
                            {formatAmount(summary.suggestion.totalAdjustment, locale)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>{t("paymentsPage.payroll.monthLabel")}</span>
                      <span className="text-slate-800 dark:text-slate-200">{formatMonthLabel(monthValue, locale)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{amountLabel}</span>
                      <span className="text-slate-800 dark:text-slate-200">{formatAmount(Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0, locale)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.payroll.emptyMember")}</p>
              )}
              <button
                type="submit"
                data-testid="payments-payroll-submit"
                className="w-full rounded-lg border border-brand-500/50 bg-brand-500/20 px-3 py-2 text-[11px] font-semibold text-slate-900 hover:bg-brand-500/30 disabled:opacity-50 dark:text-white"
                disabled={submitting || !summary || summary.balance <= 0}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                    {processingLabel}
                  </span>
                ) : (
                  payrollSubmitLabel
                )}
              </button>
            </div>
          </div>
        ) : null}
        </form>
      ) : null}

      <div className={`${CARD_CLASS} order-1`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">{t("paymentsPage.payroll.outstandingTitle")}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("paymentsPage.payroll.outstandingSubtitle", { month: formatMonthLabel(monthValue, locale) })}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={LABEL_CLASS}>{t("paymentsPage.payroll.monthLabel")}</label>
              <LocalizedMonthInput
                value={monthValue}
                onChange={(nextValue) => {
                  const boundedValue = maxMonth && nextValue > maxMonth ? maxMonth : nextValue;
                  const applyChange = () => {
                    if (isDirty) {
                      resetPayrollState({ keepMember: true });
                    }
                    clearSuccess();
                    setMonthValue(boundedValue);
                    if (memberId) {
                      setTimeout(() => {
                        amountInputRef.current?.focus();
                      }, 0);
                    }
                  };
                  if (isDirty) {
                    requestDiscard(applyChange);
                    return;
                  }
                  applyChange();
                }}
                locale={locale}
                inputClassName={`${INPUT_CLASS} payments-date-input cursor-pointer`}
                disabled={submitting}
              />
            </div>
            <button
              type="button"
              data-testid="payments-payroll-member-open"
              className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
              onClick={() => setMemberModalOpen(true)}
              disabled={submitting}
            >
              {t("paymentsPage.payroll.memberPlaceholder")}
            </button>
              {memberId ? (
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
                  onClick={() => {
                  const applyClear = () => {
                    resetPayrollState();
                    setMemberQuery("");
                  };
                  if (isDirty) {
                    requestDiscard(applyClear);
                    return;
                  }
                  applyClear();
                  }}
                  disabled={submitting}
                >
                  {t("common.actions.clear")}
                </button>
            ) : null}
          </div>
        </div>
        {outstanding ? (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {t("paymentsPage.payroll.outstandingCount", { count: outstanding.total })}
          </p>
        ) : null}

        {outstandingLoading ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("common.messages.loading")}</p>
        ) : outstandingError ? (
          <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">{outstandingError}</p>
        ) : outstanding && outstanding.items.length > 0 ? (
          <>
            <div className="mt-3">
              <DataTableShell>
                <DataTable variant="compact" minWidth="640px">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.outstandingTable.staff")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.outstandingTable.status")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.netPayable")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.paid")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.remaining")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.outstandingTable.note")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("paymentsPage.payroll.outstandingTable.history")}</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                  {outstanding.items.map((item) => {
                    const isSelected = memberId === item.member.id;
                    return (
                      <DataTableRow
                        key={item.member.id}
                        clickable
                        className={isSelected ? "app-table-row--selected" : undefined}
                        onClick={() => handleOutstandingSelect(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleOutstandingSelect(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <DataTableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {formatMemberName(item.member)}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">#{item.member.code}</span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${getPayrollStatusStyle(item.status)}`}>
                            {formatStatusLabel(item.status, t)}
                          </span>
                        </DataTableCell>
                        <DataTableCell>
                          {formatAmount(item.totalDue, locale)}
                        </DataTableCell>
                        <DataTableCell>
                          {formatAmount(item.paidAmount, locale)}
                        </DataTableCell>
                        <DataTableCell className="font-semibold text-rose-600 dark:text-rose-300">
                          {formatAmount(item.balance, locale)}
                        </DataTableCell>
                        <DataTableCell className="text-[10px] text-slate-500 dark:text-slate-400">
                          {item.source === "ESTIMATE" ? t("paymentsPage.payroll.outstandingEstimate") : "-"}
                        </DataTableCell>
                        <DataTableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOutstandingHistory(item);
                            }}
                          >
                            <HistoryIcon className="h-3 w-3" />
                            {t("paymentsPage.payroll.historyPayments")}
                          </button>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                  </DataTableBody>
                </DataTable>
              </DataTableShell>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <SummaryField label={t("paymentsPage.payroll.netPayable")} value={formatAmount(outstanding.summary.totalDue, locale)} />
              <SummaryField label={t("paymentsPage.payroll.paid")} value={formatAmount(outstanding.summary.totalPaid, locale)} />
              <SummaryField label={t("paymentsPage.payroll.remaining")} value={formatAmount(outstanding.summary.totalBalance, locale)} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("paymentsPage.payroll.outstandingEmpty")}</p>
        )}
      </div>
    </div>
  );
}
