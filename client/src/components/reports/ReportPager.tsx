import type { ReactNode } from "react";
import { PaginationControls } from "../ui/PaginationControls";

type ReportPagerProps = {
  canNext: boolean;
  canPrevious: boolean;
  nextLabel: ReactNode;
  onNext: () => void;
  onPrevious: () => void;
  pageLabel: ReactNode;
  previousLabel: ReactNode;
  rangeLabel: ReactNode;
};

export function ReportPager({
  canNext,
  canPrevious,
  nextLabel,
  onNext,
  onPrevious,
  pageLabel,
  previousLabel,
  rangeLabel,
}: ReportPagerProps) {
  return (
    <PaginationControls
      buttonVariant="text"
      canNext={canNext}
      canPrevious={canPrevious}
      className="mt-2.5"
      compact
      nextLabel={nextLabel}
      onNext={onNext}
      onPrevious={onPrevious}
      pageLabel={pageLabel}
      previousLabel={previousLabel}
      rangeLabel={rangeLabel}
    />
  );
}
