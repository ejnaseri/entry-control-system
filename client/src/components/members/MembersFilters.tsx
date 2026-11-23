import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MemberStatus } from "../../api/members";
import type { MemberType } from "../../shared/memberTypes";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: MemberStatus | "ALL";
  onStatusChange: (status: MemberStatus | "ALL") => void;
  memberTypeFilter: MemberType | "ALL";
  onMemberTypeChange: (type: MemberType | "ALL") => void;
  isRtl: boolean;
};

export function MembersFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  memberTypeFilter,
  onMemberTypeChange,
  isRtl,
}: Props) {
  const { t } = useTranslation();

  const statusOptions = useMemo(
    () => [
      { key: "ALL" as const, label: t("members.filters.all") },
      { key: "ACTIVE" as MemberStatus, label: t("members.filters.active") },
      { key: "BLOCKED" as MemberStatus, label: t("members.filters.inactive") },
    ],
    [t]
  );

  const memberTypeOptions = useMemo(
    () => [
      { key: "ALL" as const, label: t("members.filters.all") },
      { key: "STAFF" as MemberType, label: t("members.filters.staff") },
      { key: "CUSTOMER" as MemberType, label: t("members.filters.customer") },
    ],
    [t]
  );

  return (
    <div className="members-filters flex flex-col gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-lg shadow-slate-950/40">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-3">
        <div className="lg:min-w-[180px]">
          <p className="text-sm font-semibold text-white">{t("members.title")}</p>
          <p className="text-[11px] text-slate-400">{t("members.subtitle")}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-center lg:gap-3">
          <div className="members-filter-group flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t("members.table.status")}
            </span>
            <div className="members-filter-divider h-2.5 w-px bg-slate-700/70" />
            {statusOptions.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => onStatusChange(filter.key)}
                className={`members-filter-pill rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                  statusFilter === filter.key
                    ? "border-brand-400 bg-brand-500/20 text-brand-100"
                    : "border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="members-filter-group flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t("members.filters.memberType")}
            </span>
            <div className="members-filter-divider h-2.5 w-px bg-slate-700/70" />
            {memberTypeOptions.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => onMemberTypeChange(filter.key)}
                className={`members-filter-pill rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                  memberTypeFilter === filter.key
                    ? "border-brand-400 bg-brand-500/20 text-brand-100"
                    : "border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full sm:w-56 lg:w-40 lg:shrink-0">
          <input
            dir={isRtl ? "rtl" : "ltr"}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("members.searchPlaceholder")}
            className="members-search-input h-8 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
