export type ComplianceWeights = {
  lateMinutesWeight: number;
  lateCountWeight: number;
  absentWeight: number;
  noCheckoutWeight: number;
  deniedWeight: number;
};

export type ComplianceMetrics = {
  lateMinutes: number;
  lateCount: number;
  absentDays: number;
  noCheckoutCount: number;
  deniedCount: number;
};

export function computeComplianceScore(metrics: ComplianceMetrics, weights: ComplianceWeights) {
  const raw =
    100 -
    weights.lateMinutesWeight * metrics.lateMinutes -
    weights.lateCountWeight * metrics.lateCount -
    weights.absentWeight * metrics.absentDays -
    weights.noCheckoutWeight * metrics.noCheckoutCount -
    weights.deniedWeight * metrics.deniedCount;
  const clamped = Math.max(0, Math.min(100, raw));
  return Number(clamped.toFixed(2));
}
