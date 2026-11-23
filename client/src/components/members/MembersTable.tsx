import type { Member } from "../../api/members";
import { IconEye } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { MemberTypeBadge } from "./MemberTypeBadge";
import type { MemberType } from "../../shared/memberTypes";
import { MemberStatusBadge } from "./MemberStatusBadge";
import { resolveDateLocale } from "../../shared/dateLocale";
import { rtlLanguages } from "../../i18n/config";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRows,
} from "../ui/DataTable";

type Props = {
  members: Member[];
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  onRowClick: (member: Member) => void;
};

export function MembersTable({ members, loading, error, onRetry, onRowClick }: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const tableColumns = 6;

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 text-center">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-slate-700 px-2.5 py-0.5 text-[10px] font-semibold text-slate-200 hover:border-slate-500"
        >
          {t("members.actions.retry")}
        </button>
      </div>
    );
  }

  return (
    <DataTableShell>
      <DataTable fixed minWidth="820px">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[16%]" />
          <col className="w-[13%]" />
          <col className="w-[10%]" />
          <col className="w-[21%]" />
          <col className="w-[10%]" />
        </colgroup>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>{t("members.table.fullName")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("members.table.phone")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("members.table.memberType")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("members.table.status")}</DataTableHeaderCell>
            <DataTableHeaderCell>{t("members.table.membershipOrRole")}</DataTableHeaderCell>
            <DataTableHeaderCell align="center">{t("members.table.details")}</DataTableHeaderCell>
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {loading ? (
            <DataTableSkeletonRows rows={6} columns={tableColumns} />
          ) : members.length === 0 ? (
            <DataTableEmptyRow colSpan={tableColumns}>{t("members.table.empty")}</DataTableEmptyRow>
          ) : (
            members.map((member) => {
                  const memberType = (member.memberType ?? (member.isStaff ? "STAFF" : "CUSTOMER")) as MemberType;
                  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || "-";
                  const avatarText = getInitials(fullName);
                  const avatarColor = getAvatarColor(fullName);
                  const roleLabel = formatRole(member.roleType, t);
                  const resolvedMembershipEndDate = resolveMembershipEndDate(member);
                  const membershipOrRolePrimary =
                    memberType === "CUSTOMER"
                      ? formatDateOnly(resolvedMembershipEndDate, i18n.language) ?? t("members.table.noMembership")
                      : roleLabel;
                  const membershipOrRoleSecondary =
                    memberType === "CUSTOMER"
                      ? t("members.table.expireDate")
                      : member.staffGroup?.name ?? t("members.table.noGroup");
                  return (
                    <DataTableRow
                      key={member.id}
                      onClick={() => onRowClick(member)}
                      clickable
                      className="group/member-row"
                    >
                      <DataTableCell>
                        <div className="attendance-employee">
                          <span className="attendance-avatar" style={{ backgroundColor: avatarColor }}>
                            {avatarText}
                          </span>
                          <div>
                            <p className="attendance-employee__name">{fullName}</p>
                            <p className="attendance-employee__meta">#{member.code}</p>
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell>{member.phone ?? "-"}</DataTableCell>
                      <DataTableCell>
                        <MemberTypeBadge type={memberType} />
                      </DataTableCell>
                      <DataTableCell>
                        <MemberStatusBadge status={member.status} />
                      </DataTableCell>
                      <DataTableCell>
                        <div className="members-meta">
                          <p className="members-meta__primary">{membershipOrRolePrimary}</p>
                          <p className="members-meta__secondary">{membershipOrRoleSecondary}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell align="center">
                        <div className="group/member-action relative inline-flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRowClick(member);
                            }}
                            aria-label={t("members.actions.view")}
                            className="members-details-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border transition"
                          >
                            <IconEye className="h-3.5 w-3.5" stroke={1.8} />
                          </button>
                          <span
                            role="tooltip"
                            className={`pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-700/80 bg-slate-900/95 px-2.5 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-all duration-150 group-hover/member-row:translate-x-0 group-hover/member-row:opacity-100 group-focus-within/member-action:translate-x-0 group-focus-within/member-action:opacity-100 ${
                              isRtl ? "left-full ml-2 translate-x-1" : "right-full mr-2 -translate-x-1"
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-slate-700/80 bg-slate-900/95 ${
                                isRtl ? "left-0 -translate-x-1/2 border-b border-l" : "right-0 translate-x-1/2 border-r border-t"
                              }`}
                            />
                            {t("members.actions.view")}
                          </span>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })
          )}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

const AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f97316", "#a855f7", "#ef4444"];

function formatRole(roleType: Member["roleType"] | null | undefined, t: (key: string) => string) {
  if (!roleType) return t("members.table.noRole");
  const keyByRole: Record<string, string> = {
    EMPLOYEE: "members.wizard.roles.employee",
    MANAGER: "members.wizard.roles.manager",
    OWNER: "members.wizard.roles.owner",
    ADMIN: "members.wizard.roles.admin",
    COACH: "members.wizard.roles.coach",
    RECEPTION: "members.wizard.roles.reception",
    OTHER: "members.wizard.roles.other",
  };
  return t(keyByRole[roleType] ?? roleType);
}

function formatDateOnly(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(resolveDateLocale(locale));
}

function resolveMembershipEndDate(member: Member): string | null {
  if (member.expiresAt) {
    return member.expiresAt;
  }
  const rows = Array.isArray(member.memberships) ? member.memberships : [];
  if (rows.length === 0) {
    return null;
  }
  const active = rows.find((m) => m.status === "ACTIVE" || m.status === "PENDING");
  if (active?.endDate) {
    return active.endDate;
  }
  return rows[0]?.endDate ?? null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || name === "-") return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
