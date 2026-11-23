import { useTranslation } from "react-i18next";
import { useModalDismiss } from "../../hooks/useModalDismiss";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function DeleteMemberModal({ open, onClose, onConfirm, loading }: Props) {
  const { t } = useTranslation();
  useModalDismiss(onClose, open);

  if (!open) return null;

  return (
    <div className="delete-modal modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="delete-modal__panel w-full max-w-md rounded-3xl border border-rose-500/40 bg-slate-950/80 p-6 text-slate-100" onClick={(event) => event.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white">{t("members.actions.confirmDelete")}</h3>
        <p className="mt-2 text-sm text-slate-300">{t("members.actions.deleteWarning")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="delete-modal__confirm rounded-2xl border border-rose-500/40 bg-rose-500/70 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "..." : t("members.actions.delete")}
          </button>
          <button
            type="button"
            className="delete-modal__cancel btn-cancel rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200"
            onClick={onClose}
          >
            {t("members.actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
