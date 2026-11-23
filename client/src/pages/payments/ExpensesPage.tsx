import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { resolveDateLocale } from "../../shared/dateLocale";
import { localDateTimeInputToIso } from "../../shared/dateInputValue";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
import { LocalizedDateTimeInput } from "../../components/ui/LocalizedDateTimeInput";
import { PaginationControls } from "../../components/ui/PaginationControls";
import {
  createExpense,
  createExpenseCategory,
  getExpenseCategories,
  getExpenses,
  reverseExpense,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpenseListResponse,
  type ExpenseStatus,
} from "../../api/expenses";
import { useToast } from "../../components/ToastContext";
import { CloseIconButton } from "../../components/CloseIconButton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { useModalDismiss } from "../../hooks/useModalDismiss";

type Filters = {
  from: string;
  to: string;
  categoryId: string;
  status: "" | ExpenseStatus;
  search: string;
  page: number;
};

type ExpenseFormState = {
  categoryId: string;
  amount: string;
  occurredAt: string;
  vendorName: string;
  reference: string;
  notes: string;
};

type FormTouched = {
  categoryId: boolean;
  amount: boolean;
  occurredAt: boolean;
};

type CategoryShare = {
  categoryId: string;
  name: string;
  value: number;
  pct: number;
};

type PieDatum = CategoryShare & {
  fill: string;
  isLargest: boolean;
};

type MonthBucket = {
  monthKey: string;
  label: string;
  total: number;
  breakdown: Array<{ name: string; value: number }>;
  previousTotal: number | null;
};

type TrendDirection = "up" | "down" | "flat";

const CARD_CLASS = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950";
const INPUT_CLASS =
  "h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
const LABEL_CLASS = "text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const PAGE_SIZE = 25;
const CHART_COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#0f766e", "#14b8a6", "#0891b2", "#475569"];

const EMPTY_SUMMARY: ExpenseListResponse["summary"] = {
  grossOutflow: 0,
  adjustments: 0,
  netOutflow: 0,
  expenseCount: 0,
  adjustmentCount: 0,
};

const EMPTY_REPORT: ExpenseListResponse = {
  generatedAt: new Date(0).toISOString(),
  filters: {
    from: dateInput(new Date()),
    to: dateInput(new Date()),
    categoryId: null,
    status: null,
    search: null,
    sortBy: "occurredAt",
    sortDir: "desc",
  },
  summary: EMPTY_SUMMARY,
  items: [],
  analytics: {
    categoryBreakdown: [],
    monthlyTrend: [],
  },
  pageInfo: {
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 1,
  },
};

export function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const numberLocale = useMemo(() => resolveNumberLocale(i18n.language), [i18n.language]);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [report, setReport] = useState<ExpenseListResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [monthlyTrend, setMonthlyTrend] = useState<ExpenseListResponse["analytics"]["monthlyTrend"]>([]);
  const [listReloadKey, setListReloadKey] = useState(0);
  const [categoryReloadKey, setCategoryReloadKey] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formTouched, setFormTouched] = useState<FormTouched>({
    categoryId: false,
    amount: false,
    occurredAt: false,
  });
  const [filters, setFilters] = useState<Filters>(() => ({
    from: firstDayOfMonthInput(),
    to: dateInput(new Date()),
    categoryId: "",
    status: "",
    search: "",
    page: 1,
  }));
  const [form, setForm] = useState<ExpenseFormState>({
    categoryId: "",
    amount: "",
    occurredAt: dateTimeLocalInput(new Date()),
    vendorName: "",
    reference: "",
    notes: "",
  });
  const closeExpenseModal = useCallback(() => setExpenseModalOpen(false), []);
  useModalDismiss(closeExpenseModal, expenseModalOpen);

  const query = useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
      categoryId: filters.categoryId || undefined,
      status: filters.status || undefined,
      search: filters.search.trim() || undefined,
      sortBy: "occurredAt" as const,
      sortDir: "desc" as const,
      page: filters.page,
      pageSize: PAGE_SIZE,
    }),
    [filters]
  );

  useEffect(() => {
    let mounted = true;
    getExpenseCategories()
      .then(({ data }) => {
        if (!mounted) return;
        setCategories(data);
        if (!form.categoryId && data.length) {
          setForm((prev) => ({ ...prev, categoryId: data[0]?.id ?? "" }));
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setCategories([]);
        push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.loadFailed") });
      });
    return () => {
      mounted = false;
    };
  }, [categoryReloadKey, form.categoryId, push, t]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getExpenses(query)
      .then(({ data }) => {
        if (!mounted) return;
        setReport(data);
      })
      .catch((error) => {
        if (!mounted) return;
        setReport(EMPTY_REPORT);
        push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.loadFailed") });
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [listReloadKey, push, query, t]);

  useEffect(() => {
    const now = new Date();
    const from = dateInput(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const to = dateInput(now);
    let mounted = true;

    const loadMonthlyChartItems = async () => {
      try {
        const response = await getExpenses({
          from,
          to,
          categoryId: filters.categoryId || undefined,
          status: filters.status || undefined,
          search: filters.search.trim() || undefined,
          sortBy: "occurredAt",
          sortDir: "desc",
          page: 1,
          pageSize: 1,
        });
        if (!mounted) return;

        setMonthlyTrend(response.data.analytics.monthlyTrend);
      } catch (error) {
        if (!mounted) return;
        setMonthlyTrend([]);
        push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.loadFailed") });
      }
    };

    void loadMonthlyChartItems();

    return () => {
      mounted = false;
    };
  }, [filters.categoryId, filters.search, filters.status, listReloadKey, push, t]);

  const amountNumber = Number(form.amount);
  const occurredAtIso = toIsoOrUndefined(form.occurredAt);
  const categoryError = formTouched.categoryId && !form.categoryId;
  const amountError = formTouched.amount && (!Number.isFinite(amountNumber) || amountNumber <= 0);
  const occurredAtError = formTouched.occurredAt && Boolean(form.occurredAt) && !occurredAtIso;

  const categoryDistribution = useMemo(
    () => buildCategoryDistribution(report.analytics.categoryBreakdown),
    [report.analytics.categoryBreakdown]
  );
  const highestCategory = categoryDistribution[0] ?? null;
  const lowestCategory = categoryDistribution.length ? categoryDistribution[categoryDistribution.length - 1] : null;
  const pieData = useMemo<PieDatum[]>(
    () =>
      categoryDistribution.map((item, index) => ({
        ...item,
        fill: CHART_COLORS[index % CHART_COLORS.length],
        isLargest: index === 0,
      })),
    [categoryDistribution]
  );
  const monthlyData = useMemo(() => buildMonthlySeries(monthlyTrend, 6, i18n.language), [monthlyTrend, i18n.language]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categoryId) count += 1;
    if (filters.status) count += 1;
    if (filters.search.trim()) count += 1;
    return count;
  }, [filters.categoryId, filters.search, filters.status]);

  const handleCreateExpense = async () => {
    setFormTouched({ categoryId: true, amount: true, occurredAt: true });

    if (!form.categoryId || !Number.isFinite(amountNumber) || amountNumber <= 0 || (form.occurredAt && !occurredAtIso)) {
      return;
    }

    setSavingExpense(true);
    try {
      await createExpense({
        categoryId: form.categoryId,
        amount: amountNumber,
        occurredAt: occurredAtIso,
        vendorName: form.vendorName.trim() || undefined,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      push({ kind: "success", title: t("expensesPage.toast.createSuccess") });
      setForm((prev) => ({
        ...prev,
        amount: "",
        vendorName: "",
        reference: "",
        notes: "",
        occurredAt: dateTimeLocalInput(new Date()),
      }));
      setFormTouched({
        categoryId: false,
        amount: false,
        occurredAt: false,
      });
      setExpenseModalOpen(false);
      setFilters((prev) => ({ ...prev, page: 1 }));
      setListReloadKey((prev) => prev + 1);
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.createFailed") });
    } finally {
      setSavingExpense(false);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setSavingCategory(true);
    try {
      const { data } = await createExpenseCategory({ name });
      push({ kind: "success", title: t("expensesPage.toast.categoryAdded") });
      setNewCategoryName("");
      setForm((prev) => ({ ...prev, categoryId: data.id }));
      setCategoryReloadKey((prev) => prev + 1);
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.categoryFailed") });
    } finally {
      setSavingCategory(false);
    }
  };

  const handleReverseExpense = async (item: ExpenseItem) => {
    const reason = window.prompt(t("expensesPage.table.reversePrompt"));
    if (reason === null) return;
    setReversingId(item.id);
    try {
      await reverseExpense(item.id, {
        occurredAt: new Date().toISOString(),
        notes: reason.trim() || undefined,
      });
      push({ kind: "success", title: t("expensesPage.toast.reverseSuccess") });
      setListReloadKey((prev) => prev + 1);
    } catch (error) {
      push({ kind: "error", title: error instanceof Error ? error.message : t("expensesPage.toast.reverseFailed") });
    } finally {
      setReversingId(null);
    }
  };

  return (
    <div className="payments-page space-y-4">
      <section className={CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("expensesPage.header.title")}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("expensesPage.header.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="expenses-create-open"
              onClick={() => setExpenseModalOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/80 px-3 py-1 text-xs font-semibold !text-white shadow-lg shadow-brand-900/35 transition hover:bg-brand-500"
            >
              + {t("expensesPage.form.title", { defaultValue: "New expense entry" })}
            </button>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {formatDateRange(filters.from, filters.to, numberLocale)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            tone="blue"
            label={t("expensesPage.summary.grossOutflow")}
            value={formatMoney(report.summary.grossOutflow, numberLocale)}
          />
          <SummaryCard
            tone="teal"
            label={t("expensesPage.summary.adjustments")}
            value={formatMoney(report.summary.adjustments, numberLocale)}
          />
          <SummaryCard
            tone="slate"
            label={t("expensesPage.summary.netOutflow")}
            value={formatMoney(report.summary.netOutflow, numberLocale)}
          />
          <SummaryCard
            tone="sky"
            label={t("expensesPage.summary.highestCategory", { defaultValue: "Highest expense category" })}
            value={formatMoney(highestCategory?.value ?? 0, numberLocale)}
            subLabel={highestCategory?.name ?? t("expensesPage.summary.noCategory", { defaultValue: "No category data yet" })}
          />
        </div>
      </section>

      <section className={CARD_CLASS}>
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-lg text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("expensesPage.filters.title", { defaultValue: "Filters" })}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {activeFilterCount
                ? `${formatCount(activeFilterCount, numberLocale)} applied`
                : t("expensesPage.filters.noneApplied", { defaultValue: "No extra filters" })}
            </span>
          </div>
          <ChevronIcon className={`h-4 w-4 text-slate-500 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("expensesPage.filters.from")}</span>
              <ShamsiDateInput
                value={filters.from}
                onChange={(value) => setFilters((prev) => ({ ...prev, from: value, page: 1 }))}
                locale={i18n.language}
                inputClassName={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("expensesPage.filters.to")}</span>
              <ShamsiDateInput
                value={filters.to}
                onChange={(value) => setFilters((prev) => ({ ...prev, to: value, page: 1 }))}
                locale={i18n.language}
                inputClassName={INPUT_CLASS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("expensesPage.filters.category")}</span>
              <select
                className={INPUT_CLASS}
                value={filters.categoryId}
                onChange={(event) => setFilters((prev) => ({ ...prev, categoryId: event.target.value, page: 1 }))}
              >
                <option value="">{t("expensesPage.filters.allCategories")}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL_CLASS}>{t("expensesPage.filters.status")}</span>
              <select
                className={INPUT_CLASS}
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as Filters["status"], page: 1 }))}
              >
                <option value="">{t("expensesPage.filters.allStatuses")}</option>
                <option value="POSTED">{t("expensesPage.status.posted")}</option>
                <option value="REVERSED">{t("expensesPage.status.reversed")}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
              <span className={LABEL_CLASS}>{t("expensesPage.filters.search")}</span>
              <input
                type="search"
                className={INPUT_CLASS}
                value={filters.search}
                placeholder={t("expensesPage.filters.searchPlaceholder")}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={CARD_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("expensesPage.analytics.pieTitle", { defaultValue: "Expense distribution by category" })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lowestCategory
                  ? t("expensesPage.analytics.lowestCategory", {
                      defaultValue: "Lowest category: {{name}} ({{share}})",
                      name: lowestCategory.name,
                      share: formatPercent(lowestCategory.pct, numberLocale),
                    })
                  : t("expensesPage.analytics.noDistribution", { defaultValue: "No distribution data available." })}
              </p>
            </div>
          </div>

          {pieData.length ? (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={2}
                    animationDuration={750}
                    animationBegin={60}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.categoryId}
                        fill={entry.fill}
                        fillOpacity={entry.isLargest ? 1 : 0.8}
                        stroke={entry.isLargest ? "#0f172a" : "transparent"}
                        strokeWidth={entry.isLargest ? 2 : 1}
                        strokeOpacity={0.2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <CategoryTooltip {...props} locale={numberLocale} />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="circle"
                    formatter={(value, _entry, index) =>
                      `${value} • ${formatPercent(pieData[index]?.pct ?? 0, numberLocale)}`
                    }
                    wrapperStyle={{ fontSize: "11px", color: "#475569" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState
              message={t("expensesPage.analytics.noDistribution", { defaultValue: "No distribution data available." })}
            />
          )}
        </article>

        <article className={CARD_CLASS}>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("expensesPage.analytics.monthlyTitle", { defaultValue: "Last 6 months outflow" })}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("expensesPage.analytics.monthlySubtitle", { defaultValue: "Monthly totals with category breakdown on hover." })}
          </p>

          {monthlyData.some((item) => item.total > 0) ? (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.22)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    dy={5}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(value: number) => formatCompactMoney(value, numberLocale)}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                    content={(props) => <MonthlyTooltip {...props} locale={numberLocale} />}
                  />
                  <Bar
                    dataKey="total"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={44}
                    animationDuration={750}
                    animationBegin={100}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState
              message={t("expensesPage.analytics.noMonthly", { defaultValue: "No monthly data available for the last 6 months." })}
            />
          )}
        </article>
      </section>

      {expenseModalOpen ? (
        <div
          className="modal-overlay fixed inset-0 z-40 flex items-center justify-center bg-slate-900/6 p-4 backdrop-blur-sm sm:p-6"
          onClick={closeExpenseModal}
        >
          <section
            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 text-slate-900 shadow-2xl shadow-black/20 dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-100 dark:shadow-black/40 sm:p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("expensesPage.form.title", { defaultValue: "New expense entry" })}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t("expensesPage.form.title", { defaultValue: "New expense entry" })}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("expensesPage.form.subtitle", { defaultValue: "Capture each expense clearly to keep your records audit-ready." })}
                </p>
              </div>
              <CloseIconButton label={t("common.actions.close")} onClick={closeExpenseModal} />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-8">
              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={LABEL_CLASS}>{t("expensesPage.form.category")}</span>
                <select
                  data-testid="expenses-create-category"
                  className={`${INPUT_CLASS} ${categoryError ? "border-rose-400 focus-visible:ring-rose-500/30" : ""}`}
                  value={form.categoryId}
                  onBlur={() => setFormTouched((prev) => ({ ...prev, categoryId: true }))}
                  onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">{t("expensesPage.form.categoryPlaceholder")}</option>
                  {categories
                    .filter((item) => item.isActive)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                {categoryError ? (
                  <span className="text-[10px] font-medium text-rose-600 dark:text-rose-300">
                    {t("expensesPage.form.errors.categoryRequired", { defaultValue: "Please select a category." })}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={LABEL_CLASS}>{t("expensesPage.form.amount")}</span>
                <input
                  data-testid="expenses-create-amount"
                  className={`${INPUT_CLASS} h-11 text-base font-semibold ${amountError ? "border-rose-400 focus-visible:ring-rose-500/30" : ""}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onBlur={() => setFormTouched((prev) => ({ ...prev, amount: true }))}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                />
                {amountError ? (
                  <span className="text-[10px] font-medium text-rose-600 dark:text-rose-300">
                    {t("expensesPage.form.errors.amountRequired", { defaultValue: "Enter a valid amount greater than zero." })}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={LABEL_CLASS}>{t("expensesPage.form.occurredAt")}</span>
                <LocalizedDateTimeInput
                  value={form.occurredAt}
                  onChange={(value) => {
                    setFormTouched((prev) => ({ ...prev, occurredAt: true }));
                    setForm((prev) => ({ ...prev, occurredAt: value }));
                  }}
                  locale={i18n.language}
                  inputClassName={`${INPUT_CLASS} expenses-occurred-at ${occurredAtError ? "border-rose-400 focus-visible:ring-rose-500/30" : ""}`}
                />
                {occurredAtError ? (
                  <span className="text-[10px] font-medium text-rose-600 dark:text-rose-300">
                    {t("expensesPage.form.errors.invalidDate", { defaultValue: "Date and time format is invalid." })}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={LABEL_CLASS}>{t("expensesPage.form.vendorName")}</span>
                <input
                  className={INPUT_CLASS}
                  type="text"
                  value={form.vendorName}
                  onChange={(event) => setForm((prev) => ({ ...prev, vendorName: event.target.value }))}
                />
              </label>

              <label className="flex flex-col gap-1.5 lg:col-span-2">
                <span className={LABEL_CLASS}>{t("expensesPage.form.reference")}</span>
                <input
                  className={INPUT_CLASS}
                  type="text"
                  value={form.reference}
                  onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
                />
              </label>

              <label className="flex flex-col gap-1.5 lg:col-span-4">
                <span className={LABEL_CLASS}>{t("expensesPage.form.notes")}</span>
                <input
                  className={INPUT_CLASS}
                  type="text"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>

              <div className="flex items-end lg:col-span-2">
                <button
                  type="button"
                  data-testid="expenses-create-submit"
                  onClick={() => void handleCreateExpense()}
                  disabled={savingExpense}
                  className="rounded-lg border border-brand-500/40 bg-brand-500/80 px-4 py-2 text-xs font-semibold !text-white shadow-lg shadow-brand-900/35 transition hover:bg-brand-500 disabled:opacity-60"
                >
                  {savingExpense ? t("expensesPage.form.submitting") : t("expensesPage.form.submit")}
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="flex flex-col gap-1.5">
                  <span className={LABEL_CLASS}>{t("expensesPage.category.title")}</span>
                  <input
                    className={INPUT_CLASS}
                    type="text"
                    value={newCategoryName}
                    placeholder={t("expensesPage.category.placeholder")}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleAddCategory()}
                  disabled={savingCategory || !newCategoryName.trim()}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 disabled:opacity-50"
                >
                  {savingCategory ? t("expensesPage.category.adding") : t("expensesPage.category.add")}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className={CARD_CLASS}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("expensesPage.table.title", { defaultValue: "Expense entries" })}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {`${formatCount(report.pageInfo.totalItems, numberLocale)} records`}
          </span>
        </div>

        <DataTableShell>
          <DataTable minWidth="860px">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeaderCell>{t("expensesPage.table.date")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.category")}</DataTableHeaderCell>
                <DataTableHeaderCell align="end">{t("expensesPage.table.amount")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.status")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.reference")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.vendor")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.notes")}</DataTableHeaderCell>
                <DataTableHeaderCell>{t("expensesPage.table.actions")}</DataTableHeaderCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {loading ? (
                <DataTableEmptyRow colSpan={8}>{t("expensesPage.table.loading")}</DataTableEmptyRow>
              ) : report.items.length === 0 ? (
                <DataTableRow>
                  <DataTableCell colSpan={8} align="center" className="app-table-empty">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                      <EmptyStateIcon className="h-7 w-7" />
                      <p className="text-sm font-medium">
                        {t("expensesPage.table.emptyModern", {
                          defaultValue: "No expenses recorded yet. Add your first expense above.",
                        })}
                      </p>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ) : (
                report.items.map((item) => {
                  const canReverse =
                    !item.isAdjustment && item.status !== "REVERSED" && !item.reversedByExpenseId && item.amount > 0;

                  return (
                    <DataTableRow key={item.id}>
                      <DataTableCell>{formatDateTime(item.occurredAt, numberLocale)}</DataTableCell>
                      <DataTableCell>{item.category.name}</DataTableCell>
                      <DataTableCell align="end" className="font-medium">{formatMoney(item.amount, numberLocale)}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge status={item.status} isAdjustment={item.isAdjustment} t={t} />
                      </DataTableCell>
                      <DataTableCell>{item.reference ?? "-"}</DataTableCell>
                      <DataTableCell>{item.vendorName ?? "-"}</DataTableCell>
                      <DataTableCell>{item.notes ?? "-"}</DataTableCell>
                      <DataTableCell>
                        {canReverse ? (
                          <button
                            type="button"
                            onClick={() => void handleReverseExpense(item)}
                            disabled={reversingId === item.id}
                            className="rounded-md border border-rose-300 bg-rose-50/60 px-2.5 py-1 text-[10px] font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-400/55 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:border-rose-300/70 dark:hover:bg-rose-500/20"
                          >
                            {reversingId === item.id ? "..." : t("expensesPage.table.reverse")}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">{t("expensesPage.table.reversed")}</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })
              )}
            </DataTableBody>
          </DataTable>
        </DataTableShell>

        <PaginationControls
          className="mt-3"
          page={report.pageInfo.page}
          pageSize={report.pageInfo.pageSize}
          totalItems={report.pageInfo.totalItems}
          totalPages={report.pageInfo.totalPages}
          onPageChange={(nextPage) => setFilters((prev) => ({ ...prev, page: nextPage }))}
        />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subLabel,
  tone,
}: {
  label: string;
  value: string;
  subLabel?: string;
  tone: "blue" | "teal" | "slate" | "sky";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/25"
      : tone === "teal"
        ? "border-teal-200 bg-teal-50/70 dark:border-teal-900/50 dark:bg-teal-950/25"
        : tone === "sky"
          ? "border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/25"
          : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40";

  return (
    <article className={`rounded-xl border p-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {subLabel ? <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subLabel}</p> : null}
    </article>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="mt-3 flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300/80 bg-slate-50/60 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <EmptyStateIcon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
      <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function CategoryTooltip(props: TooltipProps<ValueType, NameType> & { locale: string }) {
  const { active, payload, locale } = props;
  const current = payload?.[0]?.payload as PieDatum | undefined;
  if (!active || !current) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{current.name}</p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{formatMoney(current.value, locale)}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{formatPercent(current.pct, locale)}</p>
    </div>
  );
}

function MonthlyTooltip(props: TooltipProps<ValueType, NameType> & { locale: string }) {
  const { active, payload, label, locale } = props;
  const current = payload?.[0]?.payload as MonthBucket | undefined;
  if (!active || !current) return null;
  const monthlyTrend =
    current.previousTotal === null ? null : computePercentageTrend(current.total, current.previousTotal);
  const trendToneClass = monthlyTrend
    ? monthlyTrend.direction === "flat"
      ? "text-slate-500 dark:text-slate-400"
      : monthlyTrend.direction === "up"
        ? "text-rose-600 dark:text-rose-300"
        : "text-emerald-600 dark:text-emerald-300"
    : "text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</p>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{formatMoney(current.total, locale)}</p>
      {monthlyTrend ? (
        <p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${trendToneClass}`} dir="ltr">
          <TrendDeltaIcon direction={monthlyTrend.direction} className="h-3.5 w-3.5" />
          <span>{formatPercent(monthlyTrend.percent, locale)}</span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">({monthComparisonHint(locale)})</span>
        </p>
      ) : null}
      {current.previousTotal !== null ? (
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          {previousMonthLabel(locale)}: {formatMoney(current.previousTotal, locale)}
        </p>
      ) : null}
      {current.breakdown.slice(0, 3).map((item) => (
        <p key={item.name} className="text-[10px] text-slate-500 dark:text-slate-400">
          {item.name}: {formatMoney(item.value, locale)}
        </p>
      ))}
    </div>
  );
}

function StatusBadge({
  status,
  isAdjustment,
  t,
}: {
  status: ExpenseStatus;
  isAdjustment: boolean;
  t: (key: string) => string;
}) {
  const label = isAdjustment
    ? t("expensesPage.status.adjustment")
    : status === "REVERSED"
      ? t("expensesPage.status.reversed")
      : t("expensesPage.status.posted");

  const toneClass = isAdjustment
    ? "expense-status-badge--adjustment"
    : status === "REVERSED"
      ? "expense-status-badge--reversed"
      : "expense-status-badge--posted";

  return <span className={`expense-status-badge ${toneClass}`}>{label}</span>;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="m5 7 5 6 5-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function TrendDeltaIcon({ direction, className }: { direction: TrendDirection; className?: string }) {
  if (direction === "flat") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
        <path d="M5 10h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (direction === "up") {
    return (
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
        <path d="m6 13 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M10 5h4v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="m6 7 8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 15h4v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function EmptyStateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M9 13h6M9 17h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function buildCategoryDistribution(items: ExpenseListResponse["analytics"]["categoryBreakdown"]): CategoryShare[] {
  const rows = items
    .map((item) => ({
      categoryId: item.categoryId,
      name: item.categoryName,
      value: Math.max(0, item.netOutflow),
    }))
    .filter((item) => item.value > 0);
  rows.sort((a, b) => b.value - a.value);
  const total = rows.reduce((acc, row) => acc + row.value, 0);

  return rows.map((row) => ({
    ...row,
    pct: total > 0 ? (row.value / total) * 100 : 0,
  }));
}

function buildMonthlySeries(items: ExpenseListResponse["analytics"]["monthlyTrend"], months: number, language: string): MonthBucket[] {
  const monthRows = getLastMonths(months, language);
  const trendByMonth = new Map(items.map((item) => [item.monthKey, item]));

  const rows = monthRows.map((month) => {
    const trend = trendByMonth.get(month.monthKey);
    const breakdown = (trend?.categoryBreakdown ?? [])
      .map((item) => ({ name: item.categoryName, value: Math.max(0, item.netOutflow) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      monthKey: month.monthKey,
      label: month.label,
      total: Math.max(0, trend?.netOutflow ?? 0),
      breakdown,
      previousTotal: null,
    };
  });

  return rows.map((row, index) => ({
    ...row,
    previousTotal: index > 0 ? rows[index - 1]?.total ?? 0 : null,
  }));
}

function computePercentageTrend(current: number, previous: number) {
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) {
    return { direction: "flat" as const, percent: 0 };
  }
  if (Math.abs(previous) < 0.01) {
    return { direction: delta > 0 ? ("up" as const) : ("down" as const), percent: 100 };
  }
  return {
    direction: delta > 0 ? ("up" as const) : ("down" as const),
    percent: Math.min(999, Math.abs((delta / previous) * 100)),
  };
}

function getLastMonths(months: number, language: string) {
  const list: Array<{ monthKey: string; label: string }> = [];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(resolveDateLocale(language), { month: "short", year: "2-digit" });

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    list.push({ monthKey, label: formatter.format(date) });
  }

  return list;
}

function resolveNumberLocale(language: string) {
  const base = language.split("-")[0];
  if (base === "fa") return "fa-AF";
  if (base === "ps") return "ps-AF";
  return "en-US";
}

function formatMoney(value: number, locale: string) {
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  return `${formatted} ${resolveCurrencyLabel(locale)}`;
}

function formatCompactMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function resolveCurrencyLabel(locale: string) {
  if (locale.startsWith("fa")) return "افغانی";
  if (locale.startsWith("ps")) return "افغانۍ";
  return "AFN";
}

function previousMonthLabel(locale: string) {
  if (locale.startsWith("fa")) return "ماه قبل";
  if (locale.startsWith("ps")) return "تېره میاشت";
  return "Previous month";
}

function monthComparisonHint(locale: string) {
  if (locale.startsWith("fa")) return "نسبت به ماه قبل";
  if (locale.startsWith("ps")) return "د تېرې میاشتې په پرتله";
  return "vs previous month";
}

function formatPercent(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDateRange(from: string, to: string, locale: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${from} - ${to}`;
  const dateLocale = resolveDateLocale(locale);
  return `${start.toLocaleDateString(dateLocale)} - ${end.toLocaleDateString(dateLocale)}`;
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(resolveDateLocale(locale), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeLocalInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function firstDayOfMonthInput() {
  const date = new Date();
  return dateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

function toIsoOrUndefined(value: string) {
  if (!value) return undefined;
  return localDateTimeInputToIso(value) ?? undefined;
}
