import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { getMember, getMemberMemberships, updateMember } from "../../api/members";
import { MemberWizard } from "../../components/members/MemberWizard";
import { useToast } from "../../components/ToastContext";
import type { CustomerFormPayload, MemberWizardPayload, TimeRange } from "../../shared/memberTypes";
import { rtlLanguages } from "../../i18n/config";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function EditMember() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<Partial<CustomerFormPayload> | null>(null);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const blockingLoad = loading && !defaults;

  useGlobalLoading(blockingLoad, {
    message: t("common.messages.loading"),
    subtitle: t("members.actions.edit"),
  });

  const loadMember = useCallback(() => {
    if (!id) return;
    void Promise.all([getMember(id), getMemberMemberships(id)])
      .then(([memberRes, membershipsRes]) => {
        const data = memberRes.data;
        const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];
        const latestMembership = memberships[0];
        const accessRanges = groupRules(data.accessPolicy?.rules ?? []);
        const accessDefaults = {
          allowedDays: data.accessPolicy?.allowedDays?.length ? data.accessPolicy.allowedDays : ALL_DAYS,
          allowedTimeRanges: accessRanges,
          maxEntriesPerDay: data.accessPolicy?.maxEntriesPerDay ?? undefined,
        };
        const defaults: Partial<CustomerFormPayload> = {
          code: data.code ?? data.deviceUser?.externalId?.toString() ?? "",
          fingerId: data.fingerId ?? null,
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          fatherName: data.fatherName ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          gender: data.gender ?? "MALE",
          birthDate: formatDateInput(data.birthDate),
          nationalId: data.nationalId ?? "",
          notes: data.notes ?? "",
          photoUrl: data.photoUrl ?? "",
          status: data.status,
          memberType: data.memberType ?? "STAFF",
          staffGroupId: data.staffGroup?.id ?? "",
          role: {
            roleType: data.roleType ?? "EMPLOYEE",
            isStaff: data.isStaff ?? false,
            customTitle: data.customTitle ?? "",
          },
          access: {
            allowedDays: accessDefaults.allowedDays,
            allowedTimeRanges: accessDefaults.allowedTimeRanges,
          },
          customerAccess: accessDefaults,
          overtime: {
            allowOvertime: data.overtimePolicy?.allowOvertime ?? false,
            overtimeRateType: data.overtimePolicy?.overtimeRateType ?? undefined,
            overtimeAmount: data.overtimePolicy?.overtimeAmount ?? undefined,
            maxOvertimePerDay: data.overtimePolicy?.maxOvertimePerDay ?? undefined,
          },
          shifts:
            data.shifts
              ?.filter((shift) => !shift.isFromGroup && !shift.shiftId) // legacy/custom manual
              .map((shift) => ({
                id: shift.id,
                shiftName: shift.shiftName,
                shiftStart: shift.shiftStart,
                shiftEnd: shift.shiftEnd,
                salaryType: shift.salaryType,
                salaryAmount: shift.salaryAmount,
                isActive: shift.isActive,
              })) ?? [],
          extraShifts:
            data.shifts
              ?.filter((shift) => !shift.isFromGroup && shift.shiftId)
              .map((shift) => ({
                shiftId: shift.shiftId!,
                rateOverride: shift.rateOverride ?? undefined,
                isActive: shift.isActive,
              })) ?? [],
          membership: latestMembership
            ? ({
                planId: latestMembership.planId,
                startDate: formatDateInput(latestMembership.startDate),
                endDate: formatDateInput(latestMembership.endDate),
                price: Number(latestMembership.basePrice ?? latestMembership.totalDue ?? 0),
                discount: Number(latestMembership.discount ?? 0),
                paidAmount: Number(latestMembership.totalPaid ?? 0),
                status: latestMembership.status ?? "ACTIVE",
              })
            : undefined,
        };
        setDefaults(defaults);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : t("members.errors.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  useEffect(() => {
    if (loadError) {
      push({ kind: "error", title: loadError });
    }
  }, [loadError, push]);

  useEffect(() => {
    if (submitError) {
      push({ kind: "error", title: submitError });
    }
  }, [submitError, push]);

  const pageBody = useMemo(() => {
    if (blockingLoad) {
      return (
        <div className="entry-logs-compact space-y-2.5" dir={isRtl ? "rtl" : "ltr"}>
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
            <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--input-bg)]" />
            <div className="mt-2.5 h-28 w-full animate-pulse rounded-xl bg-[var(--bg-panel)]" />
          </div>
        </div>
      );
    }

    if (loadError || !defaults) {
      return (
        <div className="entry-logs-compact space-y-2.5" dir={isRtl ? "rtl" : "ltr"}>
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[11px] text-[var(--text-primary)]">
            {loadError ?? t("members.errors.loadFailed")}
            <button
              type="button"
              onClick={() => navigate("/members")}
              className="btn-cancel mt-2.5 inline-flex min-h-8 items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-[var(--text-primary)]"
            >
              {t("members.actions.cancel")}
            </button>
          </div>
        </div>
      );
    }

    const handleSubmit = async (values: MemberWizardPayload | CustomerFormPayload) => {
      if (!id) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        await updateMember(id, values);
        navigate(`/members/${id}`);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t("members.errors.saveFailed"));
        setSubmitting(false);
      }
    };

    return (
      <div className="entry-logs-compact space-y-2.5" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("members.actions.edit")}</h2>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{t("members.subtitle")}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
          <MemberWizard defaultValues={defaults} submitting={submitting} onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
        </div>
      </div>
    );
  }, [blockingLoad, defaults, id, isRtl, loadError, navigate, submitting, t]);

  return pageBody;
}

function formatDateInput(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function groupRules(rules: { weekday: number; fromTime: string; toTime: string }[]) {
  const map = new Map<number, TimeRange[]>();
  rules.forEach((rule) => {
    const list = map.get(rule.weekday) ?? [];
    list.push({ from: rule.fromTime, to: rule.toTime });
    map.set(rule.weekday, list);
  });
  return Array.from(map.entries()).map(([weekday, ranges]) => ({ weekday, ranges }));
}
