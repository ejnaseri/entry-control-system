import { Router } from "express";
import type { Request } from "express";
import { HttpError } from "../../middlewares/error-handler";
import {
  expenseCategoryCreateSchema,
  expenseCategoryListQuerySchema,
  expenseCreateSchema,
  expenseListQuerySchema,
  expenseReverseParamSchema,
  expenseReverseSchema,
} from "./expenses.schemas";
import {
  createExpense,
  createExpenseCategory,
  listExpenseCategories,
  listExpenses,
  reverseExpense,
  type ExpenseActionContext,
} from "./expenses.service";

export const expensesRouter = Router();

expensesRouter.get("/categories", async (req, res, next) => {
  try {
    const query = expenseCategoryListQuerySchema.parse(req.query);
    const categories = await listExpenseCategories(query);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

expensesRouter.post("/categories", async (req, res, next) => {
  try {
    const payload = expenseCategoryCreateSchema.parse(req.body);
    const category = await createExpenseCategory(payload, getExpenseActionContext(req));
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

expensesRouter.get("/", async (req, res, next) => {
  try {
    const query = expenseListQuerySchema.parse(req.query);
    const result = await listExpenses(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

expensesRouter.post("/", async (req, res, next) => {
  try {
    const payload = expenseCreateSchema.parse(req.body);
    const expense = await createExpense(payload, getExpenseActionContext(req));
    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

expensesRouter.post("/:id/reverse", async (req, res, next) => {
  try {
    const { id } = expenseReverseParamSchema.parse(req.params);
    const payload = expenseReverseSchema.parse(req.body);
    const result = await reverseExpense(id, payload, getExpenseActionContext(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

function getExpenseActionContext(req: Request): ExpenseActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: ExpenseActionContext["meta"] = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;

  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta,
  };
}
