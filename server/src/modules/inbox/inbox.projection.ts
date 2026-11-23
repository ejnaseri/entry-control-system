import { AdminPermission, type InboxItem } from "@prisma/client";
import type { AppEdition } from "../../config/env";

export function projectInboxItemForPermissions(
  item: InboxItem,
  edition: AppEdition,
  permissions: readonly AdminPermission[]
): InboxItem {
  if (!item.actionPath) return item;
  const requiredPermission = getActionPathPermission(item.actionPath, edition);
  if (requiredPermission && permissions.includes(requiredPermission)) return item;
  return { ...item, actionPath: null };
}

function getActionPathPermission(actionPath: string, edition: AppEdition): AdminPermission | null {
  if (actionPath === "/devices" || actionPath.startsWith("/devices/")) {
    return AdminPermission.DEVICES_VIEW;
  }
  if (actionPath === "/entry-logs" || actionPath.startsWith("/entry-logs/")) {
    return AdminPermission.ATTENDANCE_VIEW;
  }
  if (actionPath.startsWith("/employees/")) {
    return edition === "ATTENDANCE" ? AdminPermission.MEMBERS_VIEW : null;
  }
  if (actionPath.startsWith("/members/")) {
    return edition === "FULL" ? AdminPermission.MEMBERS_VIEW : null;
  }
  return null;
}
