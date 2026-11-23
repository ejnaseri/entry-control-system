import { useEffect, useState, type ComponentType } from "react";

export type ShamsiDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  inputClassName?: string;
  containerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
};

type ShamsiDateInputModule = typeof import("./ShamsiDateInputImpl");

let shamsiDateInputLoader: Promise<ShamsiDateInputModule> | null = null;

function loadShamsiDateInput() {
  shamsiDateInputLoader ??= import("./ShamsiDateInputImpl");
  return shamsiDateInputLoader;
}

export function ShamsiDateInput(props: ShamsiDateInputProps) {
  const [LoadedInput, setLoadedInput] = useState<ComponentType<ShamsiDateInputProps> | null>(null);

  useEffect(() => {
    let active = true;
    loadShamsiDateInput().then((module) => {
      if (!active) return;
      setLoadedInput(() => module.ShamsiDateInputImpl);
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
        placeholder={props.placeholder ?? "YYYY/MM/DD"}
        className={props.inputClassName}
        aria-busy="true"
      />
    </div>
  );
}
