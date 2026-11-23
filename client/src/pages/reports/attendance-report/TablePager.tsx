import type { AttendanceReportPageInfo } from "../../../api/reportsAttendance";
import { useTranslation } from "react-i18next";
import { ReportPager } from "../../../components/reports/ReportPager";

export function TablePager({
  pageInfo,
  page,
  onPageChange,
}: {
  pageInfo: AttendanceReportPageInfo;
  page: number;
  onPageChange: (nextPage: number) => void;
}) {
  const { t } = useTranslation();
  const start = pageInfo.totalItems ? (page - 1) * pageInfo.pageSize + 1 : 0;
  const end = pageInfo.totalItems ? Math.min(pageInfo.totalItems, page * pageInfo.pageSize) : 0;

  return (
    <ReportPager
      rangeLabel={t("attendanceReport.pager.rangeOfTotal", { start, end, total: pageInfo.totalItems })}
      pageLabel={`${page}/${pageInfo.totalPages}`}
      previousLabel="<"
      nextLabel=">"
      canPrevious={page > 1}
      canNext={page < pageInfo.totalPages}
      onPrevious={() => onPageChange(page - 1)}
      onNext={() => onPageChange(page + 1)}
    />
  );
}
