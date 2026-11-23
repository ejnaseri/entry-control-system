export type VarianceBucket = "zero" | "small" | "medium" | "large";

export function resolveVarianceBucket(value: number, smallThreshold: number, mediumThreshold: number): VarianceBucket {
  const absValue = Math.abs(value);
  if (absValue < 1) return "zero";
  if (absValue < smallThreshold) return "small";
  if (absValue < mediumThreshold) return "medium";
  return "large";
}
