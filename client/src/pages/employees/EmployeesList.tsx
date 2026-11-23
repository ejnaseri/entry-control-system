import { IconEye } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { listEmployees, listEmployeeStaffGroupOptions, type EmployeeStaffGroupOption, type EmployeeStatus, type EmployeeSummary } from "../../api/employees";
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
import { PaginationControls } from "../../components/ui/PaginationControls";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { rtlLanguages } from "../../i18n/config";
import { getEmployeeCopy } from "./employeeCopy";

const PAGE_SIZE = 20;

export function EmployeesList() {
  const { i18n } = useTranslation();
  const copy = getEmployeeCopy(i18n.language);
  const navigate = useNavigate();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [items, setItems] = useState<EmployeeSummary[]>([]);
  const [groups, setGroups] = useState<EmployeeStaffGroupOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | EmployeeStatus>("");
  const [staffGroupId, setStaffGroupId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listEmployees({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status ? { status } : {}),
        ...(staffGroupId ? { staffGroupId } : {}),
        includeArchived,
        take: PAGE_SIZE,
        skip,
      });
      setItems(response.data.items);
      setTotal(response.data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, includeArchived, search, skip, staffGroupId, status]);

  useEffect(() => {
    void listEmployeeStaffGroupOptions().then((response) => setGroups(response.data)).catch(() => setGroups([]));
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { setSkip(0); }, [includeArchived, search, staffGroupId, status]);

  const page = Math.floor(skip / PAGE_SIZE) + 1;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <section className="members-compact space-y-4" data-testid="employees-list" dir={isRtl ? "rtl" : "ltr"}>
      <EmployeeFilters
        copy={copy}
        groups={groups}
        includeArchived={includeArchived}
        isRtl={isRtl}
        search={search}
        staffGroupId={staffGroupId}
        status={status}
        onArchivedChange={setIncludeArchived}
        onGroupChange={setStaffGroupId}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />

      <EmployeesTable
        copy={copy}
        error={error}
        isRtl={isRtl}
        items={items}
        loading={loading}
        onRetry={() => void load()}
        onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
      />

      <PaginationControls
        disabled={loading}
        nextLabel={copy.next}
        onPageChange={(nextPage) => setSkip((nextPage - 1) * PAGE_SIZE)}
        page={page}
        pageSize={PAGE_SIZE}
        previousLabel={copy.previous}
        totalItems={total}
        totalPages={totalPages}
      />
    </section>
  );
}

type Copy = ReturnType<typeof getEmployeeCopy>;

function EmployeeFilters({
  copy,
  groups,
  includeArchived,
  isRtl,
  onArchivedChange,
  onGroupChange,
  onSearchChange,
  onStatusChange,
  search,
  staffGroupId,
  status,
}: {
  copy: Copy;
  groups: EmployeeStaffGroupOption[];
  includeArchived: boolean;
  isRtl: boolean;
  onArchivedChange: (value: boolean) => void;
  onGroupChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "" | EmployeeStatus) => void;
  search: string;
  staffGroupId: string;
  status: "" | EmployeeStatus;
}) {
  const statusOptions = [
    { key: "" as const, label: copy.all },
    { key: "ACTIVE" as const, label: copy.active },
    { key: "BLOCKED" as const, label: copy.blocked },
  ];

  return (
    <div className="members-filters flex flex-col gap-2.5 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-lg shadow-slate-950/40">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center lg:gap-3">
        <div className="lg:min-w-[180px]">
          <p className="text-sm font-semibold text-white">{copy.employees}</p>
          <p className="text-[11px] text-slate-400">{copy.employeeOnly}</p>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-center lg:gap-3">
          <div className="members-filter-group flex flex-wrap items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{copy.status}</span>
            <div className="members-filter-divider h-2.5 w-px bg-slate-700/70" />
            {statusOptions.map((option) => (
              <button
                className={`members-filter-pill rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${status === option.key ? "border-brand-400 bg-brand-500/20 text-brand-100" : "border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white"}`}
                key={option.key || "ALL"}
                onClick={() => onStatusChange(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="members-filter-group flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{copy.group}</span>
            <div className="members-filter-divider h-2.5 w-px bg-slate-700/70" />
            <DropdownSelect
              ariaLabel={copy.group}
              buttonClassName="employees-members-select"
              onChange={onGroupChange}
              options={[{ value: "", label: copy.all }, ...groups.map((group) => ({ value: group.id, label: group.name }))]}
              value={staffGroupId}
            />
            <button
              aria-pressed={includeArchived}
              className={`members-filter-pill rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${includeArchived ? "border-brand-400 bg-brand-500/20 text-brand-100" : "border-slate-800 text-slate-300 hover:border-brand-400/50 hover:text-white"}`}
              onClick={() => onArchivedChange(!includeArchived)}
              type="button"
            >
              {copy.includeArchived}
            </button>
          </div>
        </div>
        <div className="relative w-full sm:w-56 lg:w-40 lg:shrink-0">
          <input
            aria-label={copy.search}
            className="members-search-input h-8 w-full rounded-lg border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none"
            dir={isRtl ? "rtl" : "ltr"}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={copy.search}
            type="search"
            value={search}
          />
        </div>
      </div>
    </div>
  );
}

function EmployeesTable({ copy, error, isRtl, items, loading, onRetry, onRowClick }: {
  copy: Copy;
  error: string | null;
  isRtl: boolean;
  items: EmployeeSummary[];
  loading: boolean;
  onRetry: () => void;
  onRowClick: (employee: EmployeeSummary) => void;
}) {
  const columns = 6;

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 text-center" role="alert">
        <p className="mb-2 text-xs text-rose-300">{copy.loadFailed}</p>
        <button className="rounded-full border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-slate-500" onClick={onRetry} type="button">
          {copy.retry}
        </button>
      </div>
    );
  }

  return (
    <DataTableShell data-testid="employees-table">
      <DataTable className="attendance-employees-table" fixed minWidth="820px">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[16%]" />
          <col className="w-[15%]" />
          <col className="w-[10%]" />
          <col className="w-[19%]" />
          <col className="w-[10%]" />
        </colgroup>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>{copy.name}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.contact}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.group}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.status}</DataTableHeaderCell>
            <DataTableHeaderCell>{copy.role}</DataTableHeaderCell>
            <DataTableHeaderCell align="center">{copy.employeeDetails}</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {loading ? <DataTableSkeletonRows columns={columns} rows={6} /> : items.length === 0 ? (
            <DataTableEmptyRow colSpan={columns}>{copy.noEmployees}</DataTableEmptyRow>
          ) : items.map((employee) => {
            const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim() || "—";
            return (
              <DataTableRow clickable className="group/member-row" data-testid="employee-row" key={employee.id} onClick={() => onRowClick(employee)}>
                <DataTableCell>
                  <div className="attendance-employee">
                    <span className="attendance-avatar" style={{ backgroundColor: getAvatarColor(fullName) }}>{getInitials(fullName)}</span>
                    <div><p className="attendance-employee__name">{fullName}</p><p className="attendance-employee__meta">#{employee.code}</p></div>
                  </div>
                </DataTableCell>
                <DataTableCell>{employee.phone || "—"}</DataTableCell>
                <DataTableCell>
                  <div className="members-meta"><p className="members-meta__primary">{employee.staffGroup?.name || "—"}</p><p className="members-meta__secondary">{copy.group}</p></div>
                </DataTableCell>
                <DataTableCell><EmployeeStatusBadge copy={copy} employee={employee} /></DataTableCell>
                <DataTableCell>
                  <div className="members-meta"><p className="members-meta__primary">{employee.customTitle || employee.roleType || "—"}</p><p className="members-meta__secondary">{copy.role}</p></div>
                </DataTableCell>
                <DataTableCell align="center">
                  <div className="group/member-action relative inline-flex">
                    <button aria-label={copy.view} className="members-details-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border transition" onClick={(event) => { event.stopPropagation(); onRowClick(employee); }} type="button">
                      <IconEye className="h-3.5 w-3.5" stroke={1.8} />
                    </button>
                    <span className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-all duration-150 group-hover/member-row:translate-x-0 group-hover/member-row:opacity-100 group-focus-within/member-action:translate-x-0 group-focus-within/member-action:opacity-100 ${isRtl ? "left-full ml-2 translate-x-1" : "right-full mr-2 -translate-x-1"}`} role="tooltip">
                      {copy.view}
                    </span>
                  </div>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

function EmployeeStatusBadge({ copy, employee }: { copy: Copy; employee: EmployeeSummary }) {
  const archived = Boolean(employee.archivedAt);
  const label = archived ? copy.archived : employee.status === "ACTIVE" ? copy.active : copy.blocked;
  const status = archived ? "ARCHIVED" : employee.status;
  const style = archived || employee.status === "BLOCKED"
    ? "bg-slate-600/10 text-slate-200 border-slate-500/40"
    : "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  return <span className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`} data-status={status}>{label}</span>;
}

const AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f97316", "#a855f7", "#ef4444"];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (!parts.length || name === "—") return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(index);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
