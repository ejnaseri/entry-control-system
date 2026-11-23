import { MemberType, Prisma } from "@prisma/client";
import { HttpError } from "../../middlewares/error-handler";

type TransactionClient = Prisma.TransactionClient;

const MAX_PRISMA_INT = 2_147_483_647;

const employeeDeviceUserIdentitySelect = {
  id: true,
  code: true,
} as const satisfies Prisma.MemberSelect;

const employeeDeviceUserSelect = {
  id: true,
  externalId: true,
  memberId: true,
} as const satisfies Prisma.DeviceUserSelect;

function deviceUserConflict(): never {
  throw new HttpError(409, "Employee code is already assigned to another device user");
}

function employeeNotFound(): never {
  throw new HttpError(404, "Employee not found");
}

function toDeviceExternalId(code: string) {
  const externalId = Number(code);
  if (!Number.isSafeInteger(externalId) || externalId <= 0 || externalId > MAX_PRISMA_INT) {
    throw new HttpError(400, "Employee code must be a positive device user ID");
  }
  return externalId;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

/**
 * Keeps the persistence-only DeviceUser mapping aligned with an Employee code.
 * This boundary intentionally has no device manager/client imports or physical-device side effects.
 */
export async function syncEmployeeDeviceUserLink(
  tx: TransactionClient,
  employeeId: string,
  code: string
): Promise<void> {
  const externalId = toDeviceExternalId(code);
  const employee = await tx.member.findFirst({
    where: {
      id: employeeId,
      code,
      memberType: MemberType.STAFF,
      isStaff: true,
    },
    select: employeeDeviceUserIdentitySelect,
  });
  if (!employee) employeeNotFound();

  const [linkedToEmployee, targetSlot] = await Promise.all([
    tx.deviceUser.findUnique({ where: { memberId: employeeId }, select: employeeDeviceUserSelect }),
    tx.deviceUser.findUnique({ where: { externalId }, select: employeeDeviceUserSelect }),
  ]);

  if (targetSlot?.memberId && targetSlot.memberId !== employeeId) deviceUserConflict();
  if (linkedToEmployee && targetSlot && linkedToEmployee.id === targetSlot.id) return;

  try {
    if (linkedToEmployee && targetSlot) {
      const released = await tx.deviceUser.updateMany({
        where: {
          id: linkedToEmployee.id,
          memberId: employeeId,
          externalId: linkedToEmployee.externalId,
        },
        data: { memberId: null, lastSyncedAt: null },
      });
      if (released.count !== 1) deviceUserConflict();

      const claimed = await tx.deviceUser.updateMany({
        where: { id: targetSlot.id, externalId, memberId: null },
        data: { memberId: employeeId, lastSyncedAt: null },
      });
      if (claimed.count !== 1) deviceUserConflict();
      return;
    }

    if (linkedToEmployee) {
      const remapped = await tx.deviceUser.updateMany({
        where: {
          id: linkedToEmployee.id,
          memberId: employeeId,
          externalId: linkedToEmployee.externalId,
        },
        // The new external ID has not been written to the previously linked
        // physical K40. Clear runtime ownership until an explicit Staff-only
        // enroll/upsert/sync operation binds and confirms it.
        data: { externalId, deviceId: null, lastSyncedAt: null },
      });
      if (remapped.count !== 1) deviceUserConflict();
      return;
    }

    if (targetSlot) {
      const claimed = await tx.deviceUser.updateMany({
        where: { id: targetSlot.id, externalId, memberId: null },
        data: { memberId: employeeId, lastSyncedAt: null },
      });
      if (claimed.count !== 1) deviceUserConflict();
      return;
    }

    await tx.deviceUser.create({ data: { externalId, memberId: employeeId } });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueConstraintError(error)) deviceUserConflict();
    throw error;
  }
}

export const employeeDeviceUserRepositoryTestHooks = {
  employeeDeviceUserIdentitySelect,
  employeeDeviceUserSelect,
  toDeviceExternalId,
};
