export const LICENSE_CORE_STAGES = [
  "PRE_DECODE",
  "CBOR_PARSE",
  "COSE_PARSE",
  "DOMAIN",
  "SCHEMA",
  "SIGNATURE",
  "TRUST",
  "CLAIMS",
  "STATE",
] as const;

export type LicenseCoreStage = (typeof LICENSE_CORE_STAGES)[number];

/**
 * A stable, hostile-input failure from the portable licensing core.
 *
 * Callers may report `stage` and `code`; `message` is diagnostic text and is
 * deliberately not part of the wire contract.
 */
export class LicenseCoreError extends Error {
  readonly stage: LicenseCoreStage;
  readonly code: string;

  constructor(stage: LicenseCoreStage, code: string, message: string) {
    super(message);
    this.name = "LicenseCoreError";
    this.stage = stage;
    this.code = code;
  }
}

export function failLicenseCore(
  stage: LicenseCoreStage,
  code: string,
  message: string,
): never {
  throw new LicenseCoreError(stage, code, message);
}

export function isLicenseCoreError(value: unknown): value is LicenseCoreError {
  return value instanceof LicenseCoreError;
}
