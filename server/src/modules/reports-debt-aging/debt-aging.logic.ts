export type DebtBucket = {
  key: string;
  label: string;
  min: number;
  max: number | null;
};

export function buildDebtBuckets(boundary1: number, boundary2: number, boundary3: number): DebtBucket[] {
  const first = Math.max(1, Math.floor(boundary1));
  const second = Math.max(first + 1, Math.floor(boundary2));
  const third = Math.max(second + 1, Math.floor(boundary3));
  return [
    { key: `0-${first}`, label: `0-${first} days`, min: 0, max: first },
    { key: `${first + 1}-${second}`, label: `${first + 1}-${second} days`, min: first + 1, max: second },
    { key: `${second + 1}-${third}`, label: `${second + 1}-${third} days`, min: second + 1, max: third },
    { key: `${third + 1}+`, label: `${third + 1}+ days`, min: third + 1, max: null },
  ];
}

export function resolveDebtBucket(daysPastDue: number, buckets: DebtBucket[]): DebtBucket {
  const normalized = Math.max(0, Math.floor(daysPastDue));
  return (
    buckets.find((bucket) => normalized >= bucket.min && (bucket.max === null || normalized <= bucket.max)) ??
    buckets[buckets.length - 1]!
  );
}
