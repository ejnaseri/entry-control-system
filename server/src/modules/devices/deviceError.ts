export function formatDeviceError(error: unknown, fallback = "Device operation failed without details") {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (typeof error === "number" || typeof error === "bigint") {
    return String(error);
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const nestedError = record["err"];
    if (nestedError && typeof nestedError === "object") {
      const nested = nestedError as Record<string, unknown>;
      const code = readErrorPart(nested["code"] ?? nested["errno"]);
      const operation = readErrorPart(nested["syscall"] ?? record["command"]);
      const address = readErrorPart(nested["address"] ?? record["ip"]);
      const port = readErrorPart(nested["port"]);
      const target = address ? `${address}${port ? `:${port}` : ""}` : port;
      const summary = [code, operation, target].filter(Boolean).join(" · ");
      if (summary) return summary;
    }
    for (const key of ["message", "error", "reason", "code", "errno"]) {
      const value = record[key];
      if (value instanceof Error && value.message.trim()) return value.message.trim();
      if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
        return String(value).trim();
      }
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized.slice(0, 1000);
    } catch {
      // Fall through to the safe fallback.
    }
  }
  return fallback;
}

function readErrorPart(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}
