import { useEffect, useState, type ComponentType } from "react";

export type LocalizedMonthInputProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  inputClassName?: string;
  containerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
};

type LocalizedMonthInputModule = typeof import("./ShamsiDateInputImpl");

let localizedMonthInputLoader: Promise<LocalizedMonthInputModule> | null = null;

function loadLocalizedMonthInput() {
  localizedMonthInputLoader ??= import("./ShamsiDateInputImpl");
  return localizedMonthInputLoader;
}

export function LocalizedMonthInput(props: LocalizedMonthInputProps) {
  const [LoadedInput, setLoadedInput] = useState<ComponentType<LocalizedMonthInputProps> | null>(null);

  useEffect(() => {
    let active = true;
    loadLocalizedMonthInput().then((module) => {
      if (!active) return;
      setLoadedInput(() => module.LocalizedMonthInputImpl);
    });

    return () => {
      active = false;
    };
  }, []);

  if (LoadedInput) {
    return <LoadedInput {...props} />;
  }

  return (
    <div className={`shamsi-date-input shamsi-date-input--fallback ${props.containerClassName ?? ""}`.trim()}>
      <input
        type="text"
        readOnly
        disabled={props.disabled}
        value={props.value}
        placeholder={props.placeholder ?? "YYYY-MM"}
        className={props.inputClassName}
        aria-busy="true"
      />
    </div>
  );
}
