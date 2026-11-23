import { api } from "./client";

export type ExpenseStatus = "POSTED" | "REVERSED";

export type ExpenseCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseListQuery = {
  from?: string;
  to?: string;
  categoryId?: string;
  status?: ExpenseStatus;
  search?: string;
  sortBy?: "occurredAt" | "amount";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type ExpenseItem = {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  amount: number;
  currency: string;
  status: ExpenseStatus;
  occurredAt: string;
  notes: string | null;
  reference: string | null;
  vendorName: string | null;
  isAdjustment: boolean;
  reversalOfExpenseId: string | null;
  reversedAt: string | null;
  reversedByExpenseId: string | null;
  reversedByReference: string | null;
  reversalOfReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseListResponse = {
  generatedAt: string;
  filters: {
    from: string;
    to: string;
    categoryId: string | null;
    status: ExpenseStatus | null;
    search: string | null;
    sortBy: "occurredAt" | "amount";
    sortDir: "asc" | "desc";
  };
  summary: {
    grossOutflow: number;
    adjustments: number;
    netOutflow: number;
    expenseCount: number;
    adjustmentCount: number;
  };
  items: ExpenseItem[];
  analytics: {
    categoryBreakdown: Array<{
      categoryId: string;
      categoryName: string;
      categorySlug: string;
      grossOutflow: number;
      adjustments: number;
      netOutflow: number;
      sharePct: number;
    }>;
    monthlyTrend: Array<{
      monthKey: string;
      grossOutflow: number;
      adjustments: number;
      netOutflow: number;
      categoryBreakdown: Array<{
        categoryId: string;
        categoryName: string;
        categorySlug: string;
        grossOutflow: number;
        adjustments: number;
        netOutflow: number;
        sharePct: number;
      }>;
    }>;
  };
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ExpenseCreateInput = {
  categoryId: string;
  amount: number;
  occurredAt?: string;
  vendorName?: string;
  reference?: string;
  notes?: string;
};

export type ExpenseReverseInput = {
  occurredAt?: string;
  notes?: string;
};

export type ExpenseReverseResponse = {
  original: ExpenseItem;
  reversal: ExpenseItem;
};

export const getExpenseCategories = (params?: { includeInactive?: boolean }) =>
  api.get<ExpenseCategory[]>("/api/v1/expenses/categories", { params });

export const createExpenseCategory = (payload: { name: string }) =>
  api.post<ExpenseCategory>("/api/v1/expenses/categories", payload);

export const getExpenses = (params: ExpenseListQuery) => api.get<ExpenseListResponse>("/api/v1/expenses", { params });

export const createExpense = (payload: ExpenseCreateInput) => api.post<ExpenseItem>("/api/v1/expenses", payload);

export const reverseExpense = (expenseId: string, payload: ExpenseReverseInput) =>
  api.post<ExpenseReverseResponse>(`/api/v1/expenses/${expenseId}/reverse`, payload);
