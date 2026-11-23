import { useEffect, useState, type ComponentType } from "react";

export type LocalizedDateTimeInputProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  inputClassName?: string;
  containerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
};

type LocalizedDateTimeInputModule = typeof import("./ShamsiDateInputImpl");

let localizedDateTimeInputLoader: Promise<LocalizedDateTimeInputModule> | null = null;

function loadLocalizedDateTimeInput() {
  localizedDateTimeInputLoader ??= import("./ShamsiDateInputImpl");
  return localizedDateTimeInputLoader;
}

export function LocalizedDateTimeInput(props: LocalizedDateTimeInputProps) {
  const [LoadedInput, setLoadedInput] = useState<ComponentType<LocalizedDateTimeInputProps> | null>(null);

  useEffect(() => {
    let active = true;
    loadLocalizedDateTimeInput().then((module) => {
      if (!active) return;
      setLoadedInput(() => module.LocalizedDateTimeInputImpl);
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
        placeholder={props.placeholder ?? "YYYY/MM/DD HH:mm"}
        className={props.inputClassName}
        aria-busy="true"
      />
    </div>
  );
}
