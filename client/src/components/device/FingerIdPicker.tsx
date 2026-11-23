import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseIconButton } from "../CloseIconButton";
import "./FingerIdPicker.css";

type FingerIdPickerProps = {
  value: number | null;
  onChange: (val: number | null) => void;
  disabled?: boolean;
};

const LEFT_FINGERS = [
  { id: 0, className: "tip tip--pinky", labelKey: "finger.leftPinky" },
  { id: 1, className: "tip tip--ring", labelKey: "finger.leftRing" },
  { id: 2, className: "tip tip--mid", labelKey: "finger.leftMiddle" },
  { id: 3, className: "tip tip--index", labelKey: "finger.leftIndex" },
];

const RIGHT_FINGERS = [
  { id: 6, className: "tip tip--index", labelKey: "finger.rightIndex" },
  { id: 7, className: "tip tip--mid", labelKey: "finger.rightMiddle" },
  { id: 8, className: "tip tip--ring", labelKey: "finger.rightRing" },
  { id: 9, className: "tip tip--pinky", labelKey: "finger.rightPinky" },
];

const FINGER_LABEL_KEYS: Record<number, string> = {
  0: "finger.leftPinky",
  1: "finger.leftRing",
  2: "finger.leftMiddle",
  3: "finger.leftIndex",
  4: "finger.leftThumb",
  5: "finger.rightThumb",
  6: "finger.rightIndex",
  7: "finger.rightMiddle",
  8: "finger.rightRing",
  9: "finger.rightPinky",
};

export function FingerIdPicker({ value, onChange, disabled = false }: FingerIdPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSelect = (id: number) => {
    if (disabled) return;
    onChange(id);
    const label = t(FINGER_LABEL_KEYS[id] ?? "finger.generic", { id });
    setNotice(t("finger.notice.selected", { label, id }));
    setOpen(false);
  };

  const handleClear = () => {
    if (disabled) return;
    onChange(null);
  };

  const selectedLabel =
    value === null || value === undefined
      ? t("finger.noneSelected")
      : t("finger.labelWithId", { label: t(FINGER_LABEL_KEYS[value] ?? "finger.generic", { id: value }), id: value });

  return (
    <div className="finger-id-picker" data-disabled={disabled ? "true" : "false"}>
      <div className="finger-id-picker__panel">
        <div className="finger-id-picker__meta">
          <div className="finger-id-picker__status">
            <span className="finger-id-picker__label">{t("finger.selectedLabel")}</span>
            <span className={`finger-id-picker__pill${value === null || value === undefined ? " is-empty" : ""}`}>
              {selectedLabel}
            </span>
          </div>
          <div className="finger-id-picker__actions">
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="finger-id-picker__open"
            >
              {t("finger.actions.choose")}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled || value === null}
              className="finger-id-picker__clear"
            >
              {t("common.actions.clear")}
            </button>
          </div>
        </div>

        <p className={`finger-id-picker__notice${notice ? " is-visible" : ""}`} role="status" aria-live="polite">
          {notice ?? ""}
        </p>
      </div>

      {open ? (
        <div
          className="finger-id-picker__overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div
            className="finger-id-picker__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="finger-id-picker__dialog-head">
              <div>
                <p id={dialogTitleId} className="finger-id-picker__dialog-title">
                  {t("finger.dialog.title")}
                </p>
                <p className="finger-id-picker__dialog-subtitle">{t("finger.dialog.subtitle")}</p>
              </div>
              <CloseIconButton label={t("common.actions.close")} onClick={() => setOpen(false)} />
            </div>

            <div className="finger-id-picker__canvas" dir="ltr">
              <main className="stage">
                <section className="hands">
                  <div className="hand hand--left" aria-label={t("finger.aria.leftHand")}>
                    <div className="fingers">
                      {LEFT_FINGERS.map((finger) => (
                        <button
                          key={finger.id}
                          className={`${finger.className}${value === finger.id ? " is-selected" : ""}`}
                          type="button"
                          aria-label={t("finger.labelWithId", { label: t(finger.labelKey), id: finger.id })}
                          aria-pressed={value === finger.id}
                          disabled={disabled}
                          onClick={() => handleSelect(finger.id)}
                        >
                          <span>{finger.id}</span>
                        </button>
                      ))}
                    </div>

                    <div className="palm" />

                    <button
                      className={`thumb${value === 4 ? " is-selected" : ""}`}
                      type="button"
                      aria-label={t("finger.labelWithId", { label: t("finger.leftThumb"), id: 4 })}
                      aria-pressed={value === 4}
                      disabled={disabled}
                      onClick={() => handleSelect(4)}
                    >
                      <span>4</span>
                    </button>
                  </div>

                  <div className="hand hand--right" aria-label={t("finger.aria.rightHand")}>
                    <div className="fingers">
                      {RIGHT_FINGERS.map((finger) => (
                        <button
                          key={finger.id}
                          className={`${finger.className}${value === finger.id ? " is-selected" : ""}`}
                          type="button"
                          aria-label={t("finger.labelWithId", { label: t(finger.labelKey), id: finger.id })}
                          aria-pressed={value === finger.id}
                          disabled={disabled}
                          onClick={() => handleSelect(finger.id)}
                        >
                          <span>{finger.id}</span>
                        </button>
                      ))}
                    </div>

                    <div className="palm" />

                    <button
                      className={`thumb${value === 5 ? " is-selected" : ""}`}
                      type="button"
                      aria-label={t("finger.labelWithId", { label: t("finger.rightThumb"), id: 5 })}
                      aria-pressed={value === 5}
                      disabled={disabled}
                      onClick={() => handleSelect(5)}
                    >
                      <span>5</span>
                    </button>
                  </div>
                </section>
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
