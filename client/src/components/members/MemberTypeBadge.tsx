import { useTranslation } from "react-i18next";
import type { MemberType } from "../../shared/memberTypes";

type Props = {
  type: MemberType;
};

const typeStyles: Record<MemberType, string> = {
  STAFF: "bg-sky-500/10 text-sky-200 border-sky-400/30",
  CUSTOMER: "bg-amber-500/10 text-amber-200 border-amber-400/30",
};

export function MemberTypeBadge({ type }: Props) {
  const { t } = useTranslation();
  const label =
    type === "STAFF"
      ? t("members.filters.staff")
      : t("members.filters.customer");

  return (
    <span className={`member-badge member-badge--type inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${typeStyles[type]}`} data-type={type}>
      {label}
    </span>
  );
}
