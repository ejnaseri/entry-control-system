import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { Member, MemberStatus } from "../../api/members";
import { getMembers } from "../../api/members";
import { MembersFilters } from "../../components/members/MembersFilters";
import { MembersTable } from "../../components/members/MembersTable";
import { useToast } from "../../components/ToastContext";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { rtlLanguages } from "../../i18n/config";
import type { MemberType } from "../../shared/memberTypes";

const PAGE_SIZE = 10;

export function MembersList() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "ALL">("ALL");
  const [memberTypeFilter, setMemberTypeFilter] = useState<MemberType | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (memberTypeFilter !== "ALL") params.memberType = memberTypeFilter;
      const { data } = await getMembers(params);
      setMembers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("members.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, memberTypeFilter, t]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  const visibleMembers = useMemo(() => {
    if (memberTypeFilter === "ALL") return members;
    return members.filter((member) => {
      const resolvedType = member.memberType ?? (member.isStaff ? "STAFF" : "CUSTOMER");
      return resolvedType === memberTypeFilter;
    });
  }, [memberTypeFilter, members]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const handleRetry = () => fetchMembers();

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, memberTypeFilter]);

  return (
    <div className="members-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <MembersFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        memberTypeFilter={memberTypeFilter}
        onMemberTypeChange={setMemberTypeFilter}
        isRtl={isRtl}
      />

      <MembersTable
        members={visibleMembers}
        loading={loading}
        error={error}
        onRetry={handleRetry}
        onRowClick={(member) => navigate(`/members/${member.id}`)}
      />

      <PaginationControls
        disabled={loading}
        page={page + 1}
        pageSize={PAGE_SIZE}
        totalItems={total}
        totalPages={totalPages}
        onPageChange={(nextPage) => setPage(nextPage - 1)}
      />
    </div>
  );
}

