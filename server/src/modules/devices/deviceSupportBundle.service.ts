import { DeviceRawLogStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { buildZipArchive } from "../../utils/zipArchive";
import { buildDeviceRawLogWhere } from "./deviceRawLogFilters";

export const DEVICE_SUPPORT_BUNDLE_MAX_LOGS = 1000;
export type DeviceSupportBundleLanguage = "en" | "fa" | "ps";

export type DeviceSupportBundleQuery = {
  deviceId?: string | undefined;
  status?: DeviceRawLogStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  search?: string | undefined;
  limit: number;
  language: DeviceSupportBundleLanguage;
};

const supportRawLogSelect = {
  id: true,
  deviceId: true,
  recordedAt: true,
  dataHash: true,
  payload: true,
  status: true,
  processError: true,
  processedAt: true,
  createdAt: true,
  device: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  attendance: {
    select: {
      id: true,
      entryType: true,
      isAuthorized: true,
      reason: true,
      recordedAt: true,
      deviceUser: {
        select: { externalId: true },
      },
      member: {
        select: {
          code: true,
          memberType: true,
        },
      },
    },
  },
} satisfies Prisma.DeviceRawLogSelect;

const supportDeviceSelect = {
  id: true,
  name: true,
  type: true,
  connectionType: true,
  enabled: true,
  status: true,
  model: true,
  serialNumber: true,
  config: true,
  lastSeenAt: true,
  lastSuccessfulPollAt: true,
  lastEventReceivedAt: true,
  lastEventProcessedAt: true,
  lastErrorAt: true,
  lastErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeviceSelect;

type SupportRawLogRow = Prisma.DeviceRawLogGetPayload<{ select: typeof supportRawLogSelect }>;
type SupportDeviceRow = Prisma.DeviceGetPayload<{ select: typeof supportDeviceSelect }>;

export type DeviceSupportBundleBuildInput = {
  query: DeviceSupportBundleQuery;
  totalMatched: number;
  statusCounts: Record<DeviceRawLogStatus, number>;
  rawLogs: SupportRawLogRow[];
  devices: SupportDeviceRow[];
  generatedAt: Date;
};

export type DeviceSupportBundleResult = {
  buffer: Buffer;
  filename: string;
  totalMatched: number;
  exportedCount: number;
  truncated: boolean;
  deviceCount: number;
};

export async function createDeviceSupportBundle(
  query: DeviceSupportBundleQuery,
  generatedAt = new Date()
): Promise<DeviceSupportBundleResult> {
  const where = buildDeviceRawLogWhere(query);
  if (!where) {
    throw new HttpError(400, "Invalid raw log date filter");
  }

  const statuses = Object.values(DeviceRawLogStatus);
  const [totalMatched, rawLogs] = await prisma.$transaction([
    prisma.deviceRawLog.count({ where }),
    prisma.deviceRawLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(query.limit, DEVICE_SUPPORT_BUNDLE_MAX_LOGS),
      select: supportRawLogSelect,
    }),
  ]);
  const statusCountValues = await prisma.$transaction(
    statuses.map((status) => prisma.deviceRawLog.count({ where: { ...where, status } }))
  );

  const deviceIds = query.deviceId
    ? [query.deviceId]
    : Array.from(new Set(rawLogs.map((rawLog) => rawLog.deviceId)));
  const devices = deviceIds.length
    ? await prisma.device.findMany({
        where: { id: { in: deviceIds } },
        orderBy: { name: "asc" },
        select: supportDeviceSelect,
      })
    : [];
  const statusCounts = statuses.reduce<Record<DeviceRawLogStatus, number>>((counts, status, index) => {
    counts[status] = statusCountValues[index] ?? 0;
    return counts;
  }, {} as Record<DeviceRawLogStatus, number>);

  return buildDeviceSupportBundle({
    query,
    totalMatched,
    statusCounts,
    rawLogs,
    devices,
    generatedAt,
  });
}

export function buildDeviceSupportBundle(input: DeviceSupportBundleBuildInput): DeviceSupportBundleResult {
  const exportedLogs = input.rawLogs.map(toSupportRawLog);
  const filters = compactObject({
    deviceId: input.query.deviceId,
    status: input.query.status,
    from: input.query.from,
    to: input.query.to,
    search: input.query.search,
  });
  const truncated = input.totalMatched > exportedLogs.length;
  const summary = {
    bundleVersion: 1,
    product: "AtlasGym",
    purpose: "Raw device log support bundle",
    generatedAt: input.generatedAt.toISOString(),
    language: input.query.language,
    filters,
    export: {
      totalMatched: input.totalMatched,
      exportedCount: exportedLogs.length,
      limit: input.query.limit,
      maximumAllowed: DEVICE_SUPPORT_BUNDLE_MAX_LOGS,
      truncated,
      sort: "newest_first",
    },
    statusCounts: input.statusCounts,
    devices: input.devices.map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type,
      connectionType: device.connectionType,
      enabled: device.enabled,
      status: device.status,
      model: device.model,
      serialNumber: device.serialNumber,
      config: sanitizeSupportValue(device.config),
      lastSeenAt: toIso(device.lastSeenAt),
      lastSuccessfulPollAt: toIso(device.lastSuccessfulPollAt),
      lastEventReceivedAt: toIso(device.lastEventReceivedAt),
      lastEventProcessedAt: toIso(device.lastEventProcessedAt),
      lastErrorAt: toIso(device.lastErrorAt),
      lastErrorMessage: device.lastErrorMessage,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    })),
    safety: {
      secretsExcluded: true,
      memberNamesExcluded: true,
      biometricTemplatesExcluded: true,
      redactedValue: "[REDACTED]",
      oversizedValuesTruncated: true,
    },
  };
  const rawLogDocument = {
    bundleVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    filters,
    totalMatched: input.totalMatched,
    exportedCount: exportedLogs.length,
    truncated,
    records: exportedLogs,
  };
  const timestamp = toFilenameTimestamp(input.generatedAt);
  const filename = `atlasgym-device-support-${timestamp}.zip`;
  const buffer = buildZipArchive(
    [
      { name: "README.txt", data: buildReadme(input.query.language, input.totalMatched, exportedLogs.length, truncated) },
      { name: "support-summary.json", data: `${JSON.stringify(summary, null, 2)}\n` },
      { name: "raw-device-logs.json", data: `${JSON.stringify(rawLogDocument, null, 2)}\n` },
      { name: "raw-device-logs.csv", data: buildRawLogsCsv(exportedLogs, input.query.language) },
    ],
    input.generatedAt
  );

  return {
    buffer,
    filename,
    totalMatched: input.totalMatched,
    exportedCount: exportedLogs.length,
    truncated,
    deviceCount: input.devices.length,
  };
}

function toSupportRawLog(rawLog: SupportRawLogRow) {
  const payloadSummary = summarizePayload(rawLog.payload);
  return {
    id: rawLog.id,
    deviceId: rawLog.deviceId,
    deviceName: rawLog.device.name,
    deviceStatus: rawLog.device.status,
    recordedAt: rawLog.recordedAt.toISOString(),
    receivedAt: rawLog.createdAt.toISOString(),
    processedAt: toIso(rawLog.processedAt),
    status: rawLog.status,
    processError: rawLog.processError,
    dataHash: rawLog.dataHash,
    externalUserId: payloadSummary.externalUserId ?? rawLog.attendance?.deviceUser?.externalId?.toString() ?? null,
    eventType: payloadSummary.eventType ?? null,
    recordId: payloadSummary.recordId ?? null,
    payload: sanitizeSupportValue(rawLog.payload),
    attendance: rawLog.attendance
      ? {
          id: rawLog.attendance.id,
          entryType: rawLog.attendance.entryType,
          isAuthorized: rawLog.attendance.isAuthorized,
          reason: rawLog.attendance.reason,
          recordedAt: rawLog.attendance.recordedAt.toISOString(),
          memberCode: rawLog.attendance.member?.code ?? null,
          memberType: rawLog.attendance.member?.memberType ?? null,
        }
      : null,
  };
}

type SupportRawLog = ReturnType<typeof toSupportRawLog>;

function summarizePayload(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const externalUserId = payload["externalUserId"];
  const eventType = payload["eventType"];
  const recordId = payload["recordId"];
  return {
    ...(typeof externalUserId === "string" || typeof externalUserId === "number"
      ? { externalUserId: String(externalUserId) }
      : {}),
    ...(typeof eventType === "string" ? { eventType } : {}),
    ...(typeof recordId === "string" || typeof recordId === "number" ? { recordId } : {}),
  };
}

const sensitiveKeys = new Set([
  "authorization",
  "apikey",
  "biometric",
  "biometricdata",
  "connectionstring",
  "cookie",
  "credential",
  "credentials",
  "databaseurl",
  "facetemplate",
  "fingerprint",
  "fingerprintdata",
  "fingerprinttemplate",
  "firstname",
  "fullname",
  "lastname",
  "membername",
  "password",
  "privatekey",
  "secret",
  "template",
  "token",
  "username",
]);

export function sanitizeSupportValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED: maximum depth reached]";
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const maximumLength = 4096;
    return value.length > maximumLength
      ? `${value.slice(0, maximumLength)}… [TRUNCATED ${value.length - maximumLength} characters]`
      : value;
  }
  if (Array.isArray(value)) {
    const maximumItems = 200;
    const items = value.slice(0, maximumItems).map((item) => sanitizeSupportValue(item, depth + 1));
    if (value.length > maximumItems) items.push(`[TRUNCATED ${value.length - maximumItems} array items]`);
    return items;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 100);
    const sanitized: Record<string, unknown> = {};
    entries.forEach(([key, item]) => {
      sanitized[key] = isSensitiveKey(key) ? "[REDACTED]" : sanitizeSupportValue(item, depth + 1);
    });
    if (Object.keys(value as Record<string, unknown>).length > entries.length) {
      sanitized["__truncatedKeys"] = Object.keys(value as Record<string, unknown>).length - entries.length;
    }
    return sanitized;
  }
  return String(value);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
  return sensitiveKeys.has(normalized)
    || /(password|passcode|secret|token|authorization|cookie|credential|privatekey|connectionstring|databaseurl)$/u.test(normalized)
    || /(biometric|fingerprint|facetemplate|fingerprinttemplate)$/u.test(normalized);
}

function buildRawLogsCsv(records: SupportRawLog[], language: DeviceSupportBundleLanguage) {
  const labels = csvLabels[language];
  const rows: unknown[][] = [
    [
      labels.logId,
      labels.device,
      labels.recordedAt,
      labels.receivedAt,
      labels.status,
      labels.externalUserId,
      labels.eventType,
      labels.recordId,
      labels.authorized,
      labels.reason,
      labels.processError,
      labels.dataHash,
      labels.payload,
    ],
    ...records.map((record) => [
      record.id,
      record.deviceName,
      record.recordedAt,
      record.receivedAt,
      record.status,
      record.externalUserId,
      record.eventType,
      record.recordId,
      record.attendance?.isAuthorized ?? null,
      record.attendance?.reason ?? null,
      record.processError,
      record.dataHash,
      JSON.stringify(record.payload),
    ]),
  ];
  return `\ufeff${rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n")}\r\n`;
}

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  const formulaSafe = /^[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

type CsvLabels = {
  logId: string;
  device: string;
  recordedAt: string;
  receivedAt: string;
  status: string;
  externalUserId: string;
  eventType: string;
  recordId: string;
  authorized: string;
  reason: string;
  processError: string;
  dataHash: string;
  payload: string;
};

const csvLabels: Record<DeviceSupportBundleLanguage, CsvLabels> = {
  en: {
    logId: "Log ID",
    device: "Device",
    recordedAt: "Device event time",
    receivedAt: "Received time",
    status: "Processing status",
    externalUserId: "Device user ID",
    eventType: "Event type",
    recordId: "Record ID",
    authorized: "Authorized",
    reason: "Decision reason",
    processError: "Processing error",
    dataHash: "Data hash",
    payload: "Sanitized payload",
  },
  fa: {
    logId: "شناسه لاگ",
    device: "دستگاه",
    recordedAt: "زمان رویداد دستگاه",
    receivedAt: "زمان دریافت",
    status: "وضعیت پردازش",
    externalUserId: "شناسه کاربر دستگاه",
    eventType: "نوع رویداد",
    recordId: "شناسه رکورد",
    authorized: "مجاز",
    reason: "دلیل تصمیم",
    processError: "خطای پردازش",
    dataHash: "هش داده",
    payload: "محتوای پاک‌سازی‌شده",
  },
  ps: {
    logId: "د لاګ پېژند",
    device: "وسیله",
    recordedAt: "د وسیلې د پېښې وخت",
    receivedAt: "د ترلاسه کولو وخت",
    status: "د پروسس حالت",
    externalUserId: "د وسیلې د کارن پېژند",
    eventType: "د پېښې ډول",
    recordId: "د ریکارډ پېژند",
    authorized: "اجازه ورکړل شوې",
    reason: "د پرېکړې دلیل",
    processError: "د پروسس تېروتنه",
    dataHash: "د معلوماتو هش",
    payload: "پاک شوی محتوا",
  },
};

function buildReadme(language: DeviceSupportBundleLanguage, total: number, exported: number, truncated: boolean) {
  const values = readmeLabels[language];
  return [
    values.title,
    "",
    values.description,
    `${values.total}: ${total}`,
    `${values.exported}: ${exported}`,
    `${values.truncated}: ${truncated ? values.yes : values.no}`,
    "",
    values.files,
    "- support-summary.json",
    "- raw-device-logs.json",
    "- raw-device-logs.csv",
    "",
    values.safety,
    "",
  ].join("\r\n");
}

type ReadmeLabels = {
  title: string;
  description: string;
  total: string;
  exported: string;
  truncated: string;
  yes: string;
  no: string;
  files: string;
  safety: string;
};

const readmeLabels: Record<DeviceSupportBundleLanguage, ReadmeLabels> = {
  en: {
    title: "AtlasGym device support bundle",
    description: "Send this ZIP file to authorized AtlasGym support when device-log diagnosis is required.",
    total: "Matching logs",
    exported: "Exported logs",
    truncated: "Limited to the newest records",
    yes: "Yes",
    no: "No",
    files: "Included files:",
    safety: "Passwords, tokens, credentials, member names, and biometric templates are excluded or redacted.",
  },
  fa: {
    title: "بسته پشتیبانی دستگاه AtlasGym",
    description: "هنگام نیاز به بررسی لاگ دستگاه، این فایل ZIP را فقط برای پشتیبانی مجاز AtlasGym ارسال کنید.",
    total: "لاگ‌های مطابق فیلتر",
    exported: "لاگ‌های خروجی‌شده",
    truncated: "محدود به جدیدترین رکوردها",
    yes: "بلی",
    no: "خیر",
    files: "فایل‌های داخل بسته:",
    safety: "رمزها، توکن‌ها، اطلاعات ورود، نام اعضا و قالب‌های بایومتریک حذف یا مخفی شده‌اند.",
  },
  ps: {
    title: "د AtlasGym د وسیلې د ملاتړ بسته",
    description: "د وسیلې د لاګونو د تشخیص پر مهال دا ZIP یوازې د AtlasGym مجاز ملاتړ ته ولېږئ.",
    total: "له فلټر سره برابر لاګونه",
    exported: "صادر شوي لاګونه",
    truncated: "یوازې تر ټولو نوي ریکارډونه",
    yes: "هو",
    no: "نه",
    files: "په بسته کې فایلونه:",
    safety: "پاسورډونه، ټوکنونه، د ننوتلو معلومات، د غړو نومونه او بایومټریک قالبونه حذف یا پټ شوي دي.",
  },
};

function toFilenameTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z").replace("T", "-");
}

function toIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}
