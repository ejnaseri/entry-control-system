import { api } from "./client";
import type { MembershipPlanDTO, MembershipPlanInput } from "../shared/membershipTypes";

export const listPlans = (includeInactive = false) =>
  api.get<MembershipPlanDTO[]>("/api/v1/membership-plans", { params: { includeInactive } });

export const createPlan = (payload: MembershipPlanInput) =>
  api.post<MembershipPlanDTO>("/api/v1/membership-plans", payload);

export const updatePlan = (id: string, payload: MembershipPlanInput) =>
  api.put<MembershipPlanDTO>(`/api/v1/membership-plans/${id}`, payload);

export const deletePlan = (id: string) => api.delete(`/api/v1/membership-plans/${id}`);
