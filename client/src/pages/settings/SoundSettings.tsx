import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../../i18n/config";
import { useToast } from "../../components/ToastContext";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import {
  deleteSoundAsset,
  getSoundAssetUrl,
  getSoundSettings,
  listSoundAssets,
  type SoundAsset,
  type SoundSettings,
  updateSoundSettings,
  uploadSoundAsset,
} from "../../api/sounds";
import { useAuth } from "../../auth/AuthContext";

const MAX_SIZE = 200 * 1024;
const MAX_DURATION_SEC = 2;
const ALLOWED_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav"];

export function SoundSettingsPage() {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("SOUND_SETTINGS_MANAGE");
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [assets, setAssets] = useState<SoundAsset[]>([]);
  const [draft, setDraft] = useState<SoundSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const blockingLoad = loading && !draft;

  useGlobalLoading(blockingLoad, {
    message: t("common.messages.loading"),
    subtitle: t("settings.sounds.title"),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [assetList, current] = await Promise.all([listSoundAssets(), getSoundSettings()]);
      setAssets(assetList);
      setDraft(current);
    } catch {
      push({ kind: "error", title: t("settings.sounds.errors.load") });
    } finally {
      setLoading(false);
    }
  }, [push, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await updateSoundSettings({
        enabled: draft.enabled,
        accessAllowedSoundId: draft.accessAllowedSoundId ?? null,
        accessDeniedSoundId: draft.accessDeniedSoundId ?? null,
        alertSoundId: draft.alertSoundId ?? null,
        accessAllowedVolume: draft.accessAllowedVolume,
        accessDeniedVolume: draft.accessDeniedVolume,
        alertVolume: draft.alertVolume,
      });
      setDraft(saved);
      window.dispatchEvent(new CustomEvent("sound:refresh"));
      push({ kind: "success", title: t("settings.sounds.errors.saveSuccess") });
    } catch {
      push({ kind: "error", title: t("settings.sounds.errors.save") });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSoundAsset(id);
    setAssets((prev) => prev.filter((item) => item.id !== id));
    setDraft((prev) => (prev ? { ...prev, accessAllowedSoundId: prev.accessAllowedSoundId === id ? null : prev.accessAllowedSoundId, accessDeniedSoundId: prev.accessDeniedSoundId === id ? null : prev.accessDeniedSoundId, alertSoundId: prev.alertSoundId === id ? null : prev.alertSoundId } : prev));
    push({ kind: "success", title: t("settings.sounds.errors.deleted") });
  };

  const handleUpload = async (file: File, target: "allowed" | "denied" | "alert") => {
    const isValid = await validateAudioFile(file, t, push);
    if (!isValid) return;
    try {
      const asset = await uploadSoundAsset(file);
      setAssets((prev) => [asset, ...prev]);
      setDraft((prev) => {
        if (!prev) return prev;
        if (target === "allowed") return { ...prev, accessAllowedSoundId: asset.id };
        if (target === "denied") return { ...prev, accessDeniedSoundId: asset.id };
        return { ...prev, alertSoundId: asset.id };
      });
      push({ kind: "success", title: t("settings.sounds.errors.uploaded") });
    } catch {
      push({ kind: "error", title: t("settings.sounds.errors.upload") });
    }
  };

  const availableOptions = useMemo(
    () => [{ id: "", name: t("settings.sounds.none") }, ...assets],
    [assets, t]
  );
  const selectedSoundsCount = [draft?.accessAllowedSoundId, draft?.accessDeniedSoundId, draft?.alertSoundId].filter(Boolean).length;

  if (blockingLoad || !draft) {
    return (
      <div className="settings-compact sounds-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 text-[11px] text-slate-300">
          {t("common.messages.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="settings-compact sounds-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{t("settings.sounds.title")}</h2>
            <p className="text-[11px] text-slate-400">{t("settings.sounds.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-slate-300">
              {t("settings.sounds.assetsTitle")}: {assets.length}
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-slate-300">
              {selectedSoundsCount}/3
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 ${
                draft.enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-700 bg-slate-900/50 text-slate-300"
              }`}
            >
              {draft.enabled ? t("common.status.active") : t("common.status.inactive")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.46fr)]">
        <fieldset disabled={!canManage} className="space-y-3">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
            <label className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/50 text-brand-200">
                  <SpeakerIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-100">{t("settings.sounds.enabled")}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{t("settings.sounds.enabledHint")}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft((prev) => (prev ? { ...prev, enabled: event.target.checked } : prev))}
                className="mt-1 h-4 w-4 rounded border-slate-600/80 bg-slate-900/60 accent-brand-500"
              />
            </label>
          </div>

          <div className="grid gap-2.5 xl:grid-cols-2">
            <SoundSection
              icon={<CheckShieldIcon className="h-3.5 w-3.5" />}
              variant="allowed"
              title={t("settings.sounds.sections.allowed")}
              description={t("settings.sounds.sections.allowedHint")}
              assets={availableOptions}
              selectedId={draft.accessAllowedSoundId ?? ""}
              volume={draft.accessAllowedVolume}
              onSelect={(value) => setDraft((prev) => (prev ? { ...prev, accessAllowedSoundId: value || null } : prev))}
              onVolume={(value) => setDraft((prev) => (prev ? { ...prev, accessAllowedVolume: value } : prev))}
              onUpload={(file) => handleUpload(file, "allowed")}
              onTest={() => playSelectedSound(draft.accessAllowedSoundId, draft.accessAllowedVolume, pendingAudioRef)}
              canUpload={canManage}
              uploadLabel={t("settings.sounds.actions.upload")}
              testLabel={t("settings.sounds.actions.test")}
            />

            <SoundSection
              icon={<DeniedIcon className="h-3.5 w-3.5" />}
              variant="denied"
              title={t("settings.sounds.sections.denied")}
              description={t("settings.sounds.sections.deniedHint")}
              assets={availableOptions}
              selectedId={draft.accessDeniedSoundId ?? ""}
              volume={draft.accessDeniedVolume}
              onSelect={(value) => setDraft((prev) => (prev ? { ...prev, accessDeniedSoundId: value || null } : prev))}
              onVolume={(value) => setDraft((prev) => (prev ? { ...prev, accessDeniedVolume: value } : prev))}
              onUpload={(file) => handleUpload(file, "denied")}
              onTest={() => playSelectedSound(draft.accessDeniedSoundId, draft.accessDeniedVolume, pendingAudioRef)}
              canUpload={canManage}
              uploadLabel={t("settings.sounds.actions.upload")}
              testLabel={t("settings.sounds.actions.test")}
            />

            <div className="xl:col-span-2">
              <SoundSection
                icon={<BellIcon className="h-3.5 w-3.5" />}
                variant="alerts"
                title={t("settings.sounds.sections.alerts")}
                description={t("settings.sounds.sections.alertsHint")}
                assets={availableOptions}
                selectedId={draft.alertSoundId ?? ""}
                volume={draft.alertVolume}
                onSelect={(value) => setDraft((prev) => (prev ? { ...prev, alertSoundId: value || null } : prev))}
                onVolume={(value) => setDraft((prev) => (prev ? { ...prev, alertVolume: value } : prev))}
                onUpload={(file) => handleUpload(file, "alert")}
                onTest={() => playSelectedSound(draft.alertSoundId, draft.alertVolume, pendingAudioRef)}
                canUpload={canManage}
                uploadLabel={t("settings.sounds.actions.upload")}
                testLabel={t("settings.sounds.actions.test")}
              />
            </div>
          </div>
        </fieldset>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-100">{t("settings.sounds.assetsTitle")}</p>
              <p className="text-[11px] text-slate-400">{t("settings.sounds.assetsHint")}</p>
            </div>
            <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-[10px] text-slate-300">
              {assets.length}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 text-[11px] text-slate-300">
            {assets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 px-2.5 py-2 text-[11px] text-slate-400">
                {t("settings.sounds.noAssets")}
              </p>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/70 bg-slate-950/45 px-2.5 py-2 transition-colors hover:border-slate-700 hover:bg-slate-900/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11px] text-slate-100" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {Math.round(asset.durationMs / 1000)}s | {Math.round(asset.size / 1024)}kb
                    </p>
                  </div>
                  {canManage ? <button
                    type="button"
                    onClick={() => handleDelete(asset.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/50 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-500/20"
                    title={t("common.actions.delete")}
                    aria-label={t("common.actions.delete")}
                  >
                    <DeleteIcon className="h-3.5 w-3.5" />
                  </button> : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {canManage ? <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-brand-500/50 bg-brand-500/20 px-4 py-2 text-[12px] font-semibold !text-white transition-colors hover:bg-brand-500/30 disabled:opacity-60"
        >
          {saving ? t("common.actions.saving") : t("common.actions.save")}
        </button>
      </div> : null}
    </div>
  );
}

function SoundSection({
  icon,
  variant,
  title,
  description,
  assets,
  selectedId,
  volume,
  onSelect,
  onVolume,
  onUpload,
  onTest,
  canUpload,
  uploadLabel,
  testLabel,
}: {
  icon: ReactNode;
  variant: "allowed" | "denied" | "alerts";
  title: string;
  description: string;
  assets: Array<{ id: string; name: string }>;
  selectedId: string;
  volume: number;
  onSelect: (value: string) => void;
  onVolume: (value: number) => void;
  onUpload: (file: File) => void;
  onTest: () => void;
  canUpload: boolean;
  uploadLabel: string;
  testLabel: string;
}) {
  const volumePercent = Math.round(volume * 100);
  const sliderStyle = { "--volume-progress": `${volumePercent}%` } as CSSProperties;
  const iconTone: Record<"allowed" | "denied" | "alerts", string> = {
    allowed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    denied: "border-brand-500/40 bg-brand-500/10 text-brand-200",
    alerts: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${iconTone[variant]}`}>
            {icon}
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-100">{title}</p>
            <p className="text-[11px] text-slate-400">{description}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 shadow-inner shadow-slate-950/55 backdrop-blur-sm">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60 text-slate-100">
            <VolumeLevelIcon percent={volumePercent} className="h-4 w-4" />
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-100">{volumePercent}%</span>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        <select
          className="form-input !h-8 !rounded-lg !px-2.5 !py-1.5 !text-[11px]"
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
        >
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
        <input
          type="range"
          className="sounds-volume-slider w-full"
          style={sliderStyle}
          min={0}
          max={100}
          value={volumePercent}
          onChange={(event) => onVolume(Number(event.target.value) / 100)}
        />
        <div className="flex items-center justify-between gap-2">
          {canUpload ? (
            <label className="cursor-pointer rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-100 transition-colors hover:border-slate-600 hover:bg-slate-900/75">
              <input
                type="file"
                accept=".mp3,.wav"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUpload(file);
                  event.currentTarget.value = "";
                }}
              />
              {uploadLabel}
            </label>
          ) : <span />}
          <button
            type="button"
            onClick={onTest}
            className="rounded-lg border border-brand-500/50 bg-brand-500/10 px-2.5 py-1 text-[11px] text-brand-200 transition-colors hover:border-brand-400 hover:bg-brand-500/20"
          >
            {testLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 9.5a4 4 0 0 1 0 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 7a8 8 0 0 1 0 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path d="M12 3 4.5 6v5.5c0 4.5 3 7.9 7.5 9 4.5-1.1 7.5-4.5 7.5-9V6L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.5 12.2 1.9 1.9 3.3-3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeniedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.7 19a1.8 1.8 0 0 0 2.6 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VolumeLevelIcon({ percent, className }: { percent: number; className?: string }) {
  const showLow = percent > 0;
  const showMid = percent >= 35;
  const showHigh = percent >= 70;
  const muted = percent <= 0;
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} className={className}>
      <path
        d="M11 5 6 9H3v6h3l5 4V5z"
        className={muted ? "text-slate-500" : "text-slate-100"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLow ? <path d="M14.5 9.5a3.1 3.1 0 0 1 0 5" className="text-slate-100" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {showMid ? <path d="M16.9 8a5.6 5.6 0 0 1 0 8" className="text-slate-100" style={{ opacity: 0.86 }} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {showHigh ? <path d="M19.1 6.3a8.1 8.1 0 0 1 0 11.4" className="text-slate-100" style={{ opacity: 0.7 }} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {muted ? <path d="m16.1 9.4 3.6 3.6m0-3.6-3.6 3.6" className="text-slate-500" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={className}>
      <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4h8v2M7 6l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function validateAudioFile(file: File, t: (key: string) => string, push: (msg: { kind: "error"; title: string }) => void) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    push({ kind: "error", title: t("settings.sounds.validation.type") });
    return false;
  }
  if (file.size > MAX_SIZE) {
    push({ kind: "error", title: t("settings.sounds.validation.size") });
    return false;
  }
  const duration = await getAudioDuration(file);
  if (!duration || duration > MAX_DURATION_SEC) {
    push({ kind: "error", title: t("settings.sounds.validation.duration") });
    return false;
  }
  return true;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(0);
    audio.src = URL.createObjectURL(file);
  });
}

function playSelectedSound(soundId: string | null | undefined, volume: number, ref: React.MutableRefObject<HTMLAudioElement | null>) {
  if (!soundId) return;
  const audio = ref.current ?? new Audio();
  audio.src = getSoundAssetUrl(soundId);
  audio.volume = volume;
  audio.currentTime = 0;
  ref.current = audio;
  audio.play().catch(() => undefined);
}

