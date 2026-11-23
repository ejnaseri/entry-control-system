import { Router } from "express";
import { listShiftTemplates } from "./shift.repository";

export const shiftRouter = Router();

shiftRouter.get("/", async (_req, res, next) => {
  try {
    const shifts = await listShiftTemplates();
    res.json(shifts);
  } catch (error) {
    next(error);
  }
});
