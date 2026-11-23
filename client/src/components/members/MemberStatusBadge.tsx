import { useTranslation } from "react-i18next";
import type { MemberStatus } from "../../api/members";

type Props = {
  status: MemberStatus;
};

const statusStyles: Record<MemberStatus, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  EXPIRED: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  DEBTOR: "bg-rose-500/15 text-rose-200 border-rose-400/30",
  BLOCKED: "bg-slate-600/10 text-slate-200 border-slate-500/40",
};

export function MemberStatusBadge({ status }: Props) {
  const { t } = useTranslation();
  const style = statusStyles[status] ?? statusStyles.ACTIVE;

  return (
    <span className={`member-badge member-badge--status inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${style}`} data-status={status}>
      {status === "ACTIVE" && t("statuses.active")}
      {status === "EXPIRED" && t("statuses.expired")}
      {status === "DEBTOR" && t("statuses.overdue")}
      {status === "BLOCKED" && t("statuses.unauthorized")}
    </span>
  );
}
