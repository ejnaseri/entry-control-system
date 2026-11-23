import { DeviceRawLogStatus, Prisma } from "@prisma/client";

export type DeviceRawLogFilterInput = {
  deviceId?: string | undefined;
  status?: DeviceRawLogStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  search?: string | undefined;
};

export function buildDeviceRawLogWhere(input: DeviceRawLogFilterInput): Prisma.DeviceRawLogWhereInput | null {
  const from = parseRawLogDateFilter(input.from, "from");
  const to = parseRawLogDateFilter(input.to, "to");
  if (from === null || to === null) return null;

  return {
    ...(input.deviceId ? { deviceId: input.deviceId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(from || to
      ? {
          recordedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(input.search ? buildRawLogSearchWhere(input.search) : {}),
  };
}

function parseRawLogDateFilter(value: string | undefined, boundary: "from" | "to") {
  if (!value) return undefined;
  const cleanValue = value.trim().replace(/\//g, "-");
  const hasExplicitTime = value.includes("T") || /\d{1,2}:\d{2}/.test(value);
  const normalized = hasExplicitTime
    ? cleanValue
    : `${cleanValue}T${boundary === "from" ? "00:00:00.000" : "23:59:59.999"}`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildRawLogSearchWhere(search: string): Prisma.DeviceRawLogWhereInput {
  return {
    OR: [
      { dataHash: { contains: search, mode: "insensitive" } },
      { processError: { contains: search, mode: "insensitive" } },
      { device: { name: { contains: search, mode: "insensitive" } } },
      {
        attendance: {
          is: {
            OR: [
              { reason: { contains: search, mode: "insensitive" } },
              {
                member: {
                  is: {
                    OR: [
                      { code: { contains: search, mode: "insensitive" } },
                      { phone: { contains: search, mode: "insensitive" } },
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    ],
  };
}
