/** Strict, allocation-bounded SemVer 2 parsing and precedence comparison. */

const CANONICAL_SEMVER =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export const SEMVER_TEXT_MINIMUM_UTF8_BYTES = 5 as const;
export const SEMVER_TEXT_MAXIMUM_UTF8_BYTES = 64 as const;

export class SemVerSyntaxError extends Error {
  readonly code = "INVALID_CANONICAL_SEMVER" as const;

  constructor(message = "Version must be canonical SemVer 2 text between 5 and 64 ASCII bytes.") {
    super(message);
    this.name = "SemVerSyntaxError";
  }
}

export type SemVerPrereleaseIdentifier =
  | Readonly<{ kind: "numeric"; raw: string; numeric: bigint }>
  | Readonly<{ kind: "text"; raw: string }>;

export interface CanonicalSemVer {
  readonly raw: string;
  readonly major: bigint;
  readonly minor: bigint;
  readonly patch: bigint;
  readonly prerelease: readonly SemVerPrereleaseIdentifier[];
  readonly build: readonly string[];
}

function requiredCapture(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined) throw new SemVerSyntaxError();
  return value;
}

export function parseCanonicalSemVer(input: string): CanonicalSemVer {
  // The grammar is ASCII-only, so JavaScript length is also the exact UTF-8 byte length.
  if (
    input.length < SEMVER_TEXT_MINIMUM_UTF8_BYTES ||
    input.length > SEMVER_TEXT_MAXIMUM_UTF8_BYTES
  ) {
    throw new SemVerSyntaxError();
  }
  const match = CANONICAL_SEMVER.exec(input);
  if (match === null) throw new SemVerSyntaxError();

  const prereleaseText = match[4];
  const buildText = match[5];
  const prerelease = prereleaseText === undefined
    ? []
    : prereleaseText.split(".").map<SemVerPrereleaseIdentifier>((raw) => {
        if (/^(0|[1-9][0-9]*)$/.test(raw)) {
          return Object.freeze({ kind: "numeric" as const, raw, numeric: BigInt(raw) });
        }
        return Object.freeze({ kind: "text" as const, raw });
      });
  const build = buildText === undefined ? [] : buildText.split(".");

  return Object.freeze({
    raw: input,
    major: BigInt(requiredCapture(match, 1)),
    minor: BigInt(requiredCapture(match, 2)),
    patch: BigInt(requiredCapture(match, 3)),
    prerelease: Object.freeze(prerelease),
    build: Object.freeze(build),
  });
}

/** Compatibility alias for consumers that use the shorter conventional name. */
export const parseSemVer = parseCanonicalSemVer;

export function isCanonicalSemVer(input: string): boolean {
  try {
    parseCanonicalSemVer(input);
    return true;
  } catch (error) {
    if (error instanceof SemVerSyntaxError) return false;
    throw error;
  }
}

function compareBigInt(left: bigint, right: bigint): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parsed(value: string | CanonicalSemVer): CanonicalSemVer {
  return typeof value === "string" ? parseCanonicalSemVer(value) : value;
}

/**
 * Compare SemVer 2 precedence.  A result below zero means left precedes right.
 * Build metadata is intentionally ignored.
 */
export function compareSemVer(
  leftInput: string | CanonicalSemVer,
  rightInput: string | CanonicalSemVer,
): -1 | 0 | 1 {
  const left = parsed(leftInput);
  const right = parsed(rightInput);
  for (const pair of [
    [left.major, right.major],
    [left.minor, right.minor],
    [left.patch, right.patch],
  ] as const) {
    const comparison = compareBigInt(pair[0], pair[1]);
    if (comparison !== 0) return comparison;
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;

  const commonLength = Math.min(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < commonLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      throw new Error("Unreachable SemVer prerelease index.");
    }
    if (leftIdentifier.kind === "numeric" && rightIdentifier.kind === "numeric") {
      const comparison = compareBigInt(leftIdentifier.numeric, rightIdentifier.numeric);
      if (comparison !== 0) return comparison;
    } else if (leftIdentifier.kind === "numeric") {
      return -1;
    } else if (rightIdentifier.kind === "numeric") {
      return 1;
    } else {
      const comparison = compareAscii(leftIdentifier.raw, rightIdentifier.raw);
      if (comparison !== 0) return comparison;
    }
  }
  return compareBigInt(BigInt(left.prerelease.length), BigInt(right.prerelease.length));
}

export function isProductVersionCompatible(
  productVersion: string | CanonicalSemVer,
  minimumProductVersion: string | CanonicalSemVer,
  maximumMajorVersion: bigint,
): boolean {
  const product = parsed(productVersion);
  const minimum = parsed(minimumProductVersion);
  if (maximumMajorVersion < 0n || minimum.major > maximumMajorVersion) return false;
  return compareSemVer(product, minimum) >= 0 && product.major <= maximumMajorVersion;
}
