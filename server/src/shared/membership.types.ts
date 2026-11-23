export type PlanDurationUnit = "DAYS" | "MONTHS";

export type MembershipPlanDTO = {
  id: string;
  name: string;
  description?: string | null;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  basePrice: number;
  price?: number;
  currency?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MembershipPlanInput = {
  name: string;
  description?: string | null;
  durationValue: number;
  durationUnit: PlanDurationUnit;
  basePrice: number;
  isActive?: boolean;
};
