# ECS Domain & Data Model

This document sketches the first iteration of the backend domain for EntryControl System (ECS).
Each table/entity maps directly to the features that need to be shipped in the MVP.

## 1. Members & Profiles
- **Member**
  - `id` (cuid), `code` (generated short id), `deviceUserId` (FK → DeviceUser.externalId)
  - Personal data: `firstName`, `lastName`, `fatherName`, `phone`, `email`, `photoUrl`, `nid`, `gender`, `birthDate`
  - Status flags cached for fast filtering: `status` (ACTIVE | EXPIRED | DEBTOR | BLOCKED), `isBlacklisted`, `notes`
  - Metadata: `createdAt`, `updatedAt`, `archivedAt`
- **DeviceUser**
  - Mirrors user slots on ZKTeco: `id`, `externalId` (numeric K40 id), `pin`, `card`, `fingerprintTemplateHash`, `lastSyncedAt`
  - `memberId` FK ensures Member ↔ Device linkage

## 2. Plans, Memberships & Payments
- **MembershipPlan**
  - `id`, `name`, `slug`, `durationDays`, `price`, `currency`, `visitLimit`, `gracePeriodDays`, `isActive`, `color`
- **Membership**
  - `id`, `memberId`, `planId`
  - Timeline: `startDate`, `endDate`, `expiresAt`, `status` (PENDING | ACTIVE | EXPIRED | SUSPENDED | CANCELLED)
  - Finance: `basePrice`, `discount`, `totalDue`, `totalPaid`
  - Flags: `autoRenew`, `createdByAdminId`, `notes`
- **Payment**
  - `id`, `memberId`, `membershipId?`
  - `amount`, `currency`, `method` (CASH | CARD | ONLINE | OTHER), `reference`, `status` (PENDING | PAID | FAILED | REFUNDED)
  - `paidAt`, `recordedByAdminId`, `dueDate` (for debtor tracking)
- **Invoice / LedgerEntry (optional)**
  - Keeps full financial audit trail if needed later; out of v1 scope.

## 3. Attendance & Access Control
- **AttendanceLog**
  - `id`, `memberId`, `deviceUserId?`, `entryType` (IN | OUT), `recordedAt`, `source` (DEVICE | MANUAL | API), `isAuthorized`, `reason`, `rawPayloadId`
- **DeviceRawLog**
  - Stores raw K40 pulls to prevent duplicates: `id`, `deviceId`, `recordedAt`, `dataHash`, `payload`, `processedAt`
- **AccessViolation**
  - Captures denied entries: `id`, `memberId?`, `deviceUserId?`, `reason` (EXPIRED | DEBTOR | UNREGISTERED | BLACKLISTED | LICENSE_LOCK), `occurredAt`, `handledBy`
- **DoorEvent**
  - `id`, `triggerType` (MEMBER | ADMIN | SCHEDULE | INTEGRATION), `triggerRefId`, `action` (OPEN | LOCK | RELEASE), `requestedAt`, `completedAt`, `relayId`, `notes`

## 4. Reporting & Analytics
- Reports are generated from the tables above; to orchestrate exports:
- **ReportJob**
  - `id`, `type` (FINANCIAL | ATTENDANCE | MEMBERSHIP_STATUS ...), `format` (PDF | XLSX), `filters` (JSONB), `status`, `generatedFileUrl`

## 5. Settings, Internationalization & Theming
- **SystemSetting**
  - `key` (LANGUAGE, DEVICE_IP, TIMEZONE, THEME, PRIMARY_COLOR, ...), `value`, `type`, `updatedByAdminId`, `updatedAt`
- **TranslationEntry**
  - `namespace`, `key`, `language` (DARI | PASHTO), `text`, `context`
- **ThemePreference**
  - `id`, `scope` (GLOBAL | ADMIN_USER), `theme` (LIGHT | DARK | CUSTOM), `primaryColor`, `accentColor`, `storedAt`

## 6. Security, Users & Licensing
- **AdminUser**
  - Credentials for dashboard access: `id`, `username`, `passwordHash`, `role`, `lastLoginAt`, `isActive`
- **FailedLoginAttempt**
  - `id`, `adminUserId?`, `username`, `ip`, `occurredAt` – used for brute-force throttling
- **AuditLog**
  - `id`, `actorType` (ADMIN | SYSTEM | MEMBER), `actorId`, `action`, `targetType`, `targetId`, `metadata`, `createdAt`
- **License projection (legacy Prisma `License` table)**
  - The table may retain only redacted display/Audit compatibility fields.
  - It is never authoritative for admission, expiry, revision, machine binding or tamper state and cannot be restored to renew/transfer a License.
  - The normative finite Offline/Hybrid design and external Secure State are defined in [`docs/licensing/design/LICENSING_DESIGN.md`](../../docs/licensing/design/LICENSING_DESIGN.md).

## 7. Operations & Maintenance
- **BackupJob**
  - `id`, `startedAt`, `finishedAt`, `status`, `location`, `size`, `triggeredBy`
- **Device**
  - Metadata for each physical terminal: `id`, `model`, `serialNumber`, `ip`, `port`, `status`, `lastSyncAt`, `timezone`

## Status Flow Summary
- Member status is derived nightly (or on mutation) from latest Membership + Payment data:
  - `ACTIVE` when `Membership.status = ACTIVE` and `totalDue <= totalPaid`
  - `EXPIRED` when `endDate < now` and not renewed
  - `DEBTOR` when `totalDue > totalPaid` and due date passed
  - `BLOCKED` only for a member-level administrative/access condition such as blacklist; a product License lock is a system admission state and must not rewrite Member status
- Attendance insertion pipeline:
  1. Pull raw logs → `DeviceRawLog`
  2. Deduplicate using `dataHash`
  3. Map `deviceUserId` → `memberId`
  4. Enforce access rules, create `AttendanceLog` or `AccessViolation`
  5. Trigger door relay + log `DoorEvent`

This foundation is enough to start the Prisma schema implementation and iterate as new requirements surface.
