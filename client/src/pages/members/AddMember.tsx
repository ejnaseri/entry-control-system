import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { createMember } from "../../api/members";
import { MemberWizard } from "../../components/members/MemberWizard";
import { useToast } from "../../components/ToastContext";
import type { CustomerFormPayload, MemberWizardPayload } from "../../shared/memberTypes";
import { rtlLanguages } from "../../i18n/config";

export function AddMember() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  const handleSubmit = async (values: MemberWizardPayload | CustomerFormPayload) => {
    setSubmitting(true);
    setError(null);
    try {
      await createMember(values);
      navigate("/members");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("members.errors.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  return (
    <div className="entry-logs-compact space-y-2.5" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("members.actions.add")}</h2>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{t("members.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-[color:var(--card-border)] bg-[var(--bg-card)] p-2.5">
        <MemberWizard submitting={submitting} onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
      </div>
    </div>
  );
}
