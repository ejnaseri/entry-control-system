INSERT INTO "AdminRolePermission" ("id", "role", "permission", "createdAt")
VALUES
  ('phase43-attendance-export-vendor', 'VENDOR_OWNER', 'ATTENDANCE_EXPORT', CURRENT_TIMESTAMP),
  ('phase43-attendance-export-owner', 'GYM_OWNER', 'ATTENDANCE_EXPORT', CURRENT_TIMESTAMP),
  ('phase43-attendance-export-admin', 'ADMIN', 'ATTENDANCE_EXPORT', CURRENT_TIMESTAMP),
  ('phase43-attendance-export-super-admin', 'SUPER_ADMIN', 'ATTENDANCE_EXPORT', CURRENT_TIMESTAMP),
  ('phase43-attendance-export-manager', 'MANAGER', 'ATTENDANCE_EXPORT', CURRENT_TIMESTAMP)
ON CONFLICT ("role", "permission") DO NOTHING;
