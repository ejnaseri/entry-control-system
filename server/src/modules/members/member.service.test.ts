import assert from "node:assert/strict";
import { AdminRole, MemberType, MembershipStatus, PaymentStatus, PlanDurationUnit } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  cancelMemberMembership,
  createMemberMembership,
  createMemberPayment,
  memberServiceTestHooks,
} from "./member.service";

type DeviceUserRow = {
  id: string;
  externalId: number;
  memberId: string | null;
};

type MembershipTotalsRow = {
  totalDue: number;
  totalPaid: number;
  payments: Array<{ amount: number }>;
};

type LifecyclePaymentRow = {
  id?: string;
  memberId?: string;
  membershipId?: string | null;
  amount: number;
  status?: PaymentStatus;
  paidAt?: Date;
  notes?: string | null;
};

type LifecycleMembershipRow = {
  id: string;
  memberId?: string;
  planId?: string;
  startDate?: Date;
  endDate?: Date;
  expiresAt?: Date;
  status?: MembershipStatus;
  basePrice?: number;
  discount?: number;
  totalDue?: number;
  totalPaid?: number;
  autoRenew?: boolean;
  notes?: string | null;
  activatedAt?: Date | null;
  createdAt?: Date;
  payments?: LifecyclePaymentRow[];
};

const prismaAny = prisma as any;
const originalPrismaFns = {
  transaction: prismaAny.$transaction,
  memberFindUnique: prismaAny.member.findUnique,
  membershipPlanFindUnique: prismaAny.membershipPlan.findUnique,
};

const membershipActionContext = {
  actor: {
    id: "admin-1",
    role: AdminRole.GYM_OWNER,
    sessionId: "session-1",
  },
  meta: {
    ipAddress: "127.0.0.1",
    userAgent: "member-service-test",
  },
};

function createDeviceUserTx(initialRows: DeviceUserRow[]) {
  const rows = initialRows.map((row) => ({ ...row }));
  const updates: Array<{ id: string; data: Partial<DeviceUserRow> }> = [];
  const creates: DeviceUserRow[] = [];

  const tx = {
    deviceUser: {
      findUnique: async ({ where }: { where: { id?: string; externalId?: number; memberId?: string | null } }) => {
        const row =
          where.id !== undefined
            ? rows.find((item) => item.id === where.id)
            : where.externalId !== undefined
              ? rows.find((item) => item.externalId === where.externalId)
              : rows.find((item) => item.memberId === where.memberId);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<DeviceUserRow> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) {
          throw new Error(`Missing device user row ${where.id}`);
        }
        Object.assign(row, data);
        updates.push({ id: where.id, data: { ...data } });
        return { ...row };
      },
      create: async ({ data }: { data: { externalId: number; memberId: string } }) => {
        const row = { id: `created-${creates.length + 1}`, externalId: data.externalId, memberId: data.memberId };
        rows.push(row);
        creates.push({ ...row });
        return { ...row };
      },
    },
  };

  return { tx: tx as any, rows, updates, creates };
}

function createMemberTotalsTx(memberships: MembershipTotalsRow[], creditAmount = 0) {
  return {
    membership: {
      findMany: async () => memberships.map((membership) => ({ ...membership })),
    },
    payment: {
      aggregate: async () => ({
        _sum: { amount: creditAmount },
        _count: { _all: creditAmount > 0 ? 1 : 0 },
      }),
    },
  } as any;
}

function restorePrismaMocks() {
  prismaAny.$transaction = originalPrismaFns.transaction;
  prismaAny.member.findUnique = originalPrismaFns.memberFindUnique;
  prismaAny.membershipPlan.findUnique = originalPrismaFns.membershipPlanFindUnique;
}

function buildLifecycleMembership(overrides: LifecycleMembershipRow): Required<Omit<LifecycleMembershipRow, "payments">> & {
  payments: LifecyclePaymentRow[];
} {
  const memberId = overrides.memberId ?? "member-1";
  const id = overrides.id;
  return {
    id,
    memberId,
    planId: overrides.planId ?? "plan-1",
    startDate: overrides.startDate ?? new Date("2026-06-01T00:00:00.000Z"),
    endDate: overrides.endDate ?? new Date("2026-07-01T00:00:00.000Z"),
    expiresAt: overrides.expiresAt ?? overrides.endDate ?? new Date("2026-07-01T00:00:00.000Z"),
    status: overrides.status ?? MembershipStatus.PENDING,
    basePrice: overrides.basePrice ?? 1300,
    discount: overrides.discount ?? 0,
    totalDue: overrides.totalDue ?? 1300,
    totalPaid: overrides.totalPaid ?? 0,
    autoRenew: overrides.autoRenew ?? false,
    notes: overrides.notes ?? null,
    activatedAt: overrides.activatedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-06-01T00:00:00.000Z"),
    payments: overrides.payments ?? [],
  };
}

function cloneMembership(row: ReturnType<typeof buildLifecycleMembership>, plan: Record<string, unknown>) {
  return {
    ...row,
    payments: row.payments.map((payment) => ({ ...payment })),
    plan: {
      id: plan["id"],
      name: plan["name"],
      durationDays: plan["durationDays"],
    },
  };
}

function matchesMembershipWhere(row: ReturnType<typeof buildLifecycleMembership>, where: any) {
  if (where?.id !== undefined) {
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (where.id?.not && row.id === where.id.not) return false;
  }
  if (where?.memberId !== undefined && row.memberId !== where.memberId) return false;
  if (where?.status?.in && !where.status.in.includes(row.status)) return false;
  if (where?.endDate?.gte && row.endDate < where.endDate.gte) return false;
  return true;
}

function matchesPaymentWhere(payment: Required<LifecyclePaymentRow>, where: any) {
  if (where?.memberId !== undefined && payment.memberId !== where.memberId) return false;
  if (where?.membershipId !== undefined) {
    if (where.membershipId === null && payment.membershipId !== null) return false;
    if (typeof where.membershipId === "string" && payment.membershipId !== where.membershipId) return false;
    if (where.membershipId?.not === null && payment.membershipId === null) return false;
  }
  if (where?.status !== undefined && payment.status !== where.status) return false;
  return true;
}

function mockMembershipLifecyclePrisma(initialMemberships: LifecycleMembershipRow[]) {
  const member = { id: "member-1", memberType: MemberType.CUSTOMER, isStaff: false };
  const plan = {
    id: "plan-1",
    name: "Two months",
    basePrice: 1300,
    durationValue: 2,
    durationUnit: PlanDurationUnit.MONTHS,
    durationDays: 60,
    isActive: true,
  };
  const memberships = initialMemberships.map((membership) => buildLifecycleMembership(membership));
  const payments = memberships.flatMap((membership) =>
    membership.payments.map((payment, index) => ({
      id: payment.id ?? `${membership.id}-payment-${index + 1}`,
      memberId: payment.memberId ?? membership.memberId,
      membershipId: payment.membershipId ?? membership.id,
      amount: payment.amount,
      status: payment.status ?? PaymentStatus.PAID,
      paidAt: payment.paidAt ?? new Date("2026-07-08T10:00:00.000Z"),
      notes: payment.notes ?? null,
    }))
  );
  const calls = {
    membershipCreates: [] as any[],
    membershipUpdates: [] as any[],
    paymentCreates: [] as any[],
    customerProfileUpserts: [] as any[],
    auditCreates: [] as any[],
  };

  const tx = {
    membership: {
      findFirst: async ({ where, orderBy }: { where: any; orderBy?: any }) => {
        const matched = memberships.filter((membership) => matchesMembershipWhere(membership, where));
        if (orderBy?.endDate === "desc") {
          matched.sort((left, right) => right.endDate.getTime() - left.endDate.getTime());
        }
        return matched[0] ? cloneMembership(matched[0], plan) : null;
      },
      create: async ({ data }: { data: any; include?: any }) => {
        const row = buildLifecycleMembership({
          id: `membership-${memberships.length + 1}`,
          ...data,
          createdAt: new Date("2026-07-09T00:00:00.000Z"),
          payments: [],
        });
        memberships.push(row);
        calls.membershipCreates.push(data);
        return cloneMembership(row, plan);
      },
      findUnique: async ({ where, select }: { where: { id: string }; select?: any }) => {
        const row = memberships.find((membership) => membership.id === where.id);
        if (!row) return null;
        if (select) {
          return Object.fromEntries(Object.keys(select).map((key) => [key, (row as any)[key]]));
        }
        return cloneMembership(row, plan);
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string }; include?: any }) => {
        const row = memberships.find((membership) => membership.id === where.id);
        if (!row) throw new Error(`Missing membership ${where.id}`);
        return cloneMembership(row, plan);
      },
      findMany: async ({ where }: { where: { memberId: string }; select?: any }) =>
        memberships
          .filter((membership) => membership.memberId === where.memberId)
          .map((membership) => ({
            totalDue: membership.totalDue,
            totalPaid: membership.totalPaid,
            payments: payments
              .filter((payment) => payment.membershipId === membership.id && payment.status === PaymentStatus.PAID)
              .map((payment) => ({ amount: payment.amount })),
          })),
      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const row = memberships.find((membership) => membership.id === where.id);
        if (!row) throw new Error(`Missing membership ${where.id}`);
        Object.assign(row, data);
        calls.membershipUpdates.push({ where, data });
        return cloneMembership(row, plan);
      },
    },
    payment: {
      aggregate: async ({ where }: { where: any }) => {
        const matched = payments.filter((payment) => matchesPaymentWhere(payment, where));
        return {
          _sum: { amount: matched.reduce((sum, payment) => sum + payment.amount, 0) },
          _count: { _all: matched.length },
        };
      },
      create: async ({ data }: { data: any }) => {
        const row = {
          id: data.id,
          memberId: data.memberId,
          membershipId: data.membershipId ?? null,
          amount: data.amount,
          status: data.status ?? PaymentStatus.PAID,
          paidAt: data.paidAt,
          notes: data.notes ?? null,
        };
        payments.push(row);
        calls.paymentCreates.push(data);
        return { ...row, currency: data.currency, method: data.method, reference: data.reference };
      },
    },
    customerProfile: {
      upsert: async (args: any) => {
        calls.customerProfileUpserts.push(args);
        return { memberId: args.where.memberId, ...args.update };
      },
    },
    auditLog: {
      create: async ({ data }: { data: any }) => {
        calls.auditCreates.push(data);
        return { id: `audit-${calls.auditCreates.length}`, ...data };
      },
    },
  };

  prismaAny.member.findUnique = async ({ where }: { where: { id: string } }) => (where.id === member.id ? member : null);
  prismaAny.membershipPlan.findUnique = async ({ where }: { where: { id: string; isActive?: boolean } }) =>
    where.id === plan.id && where.isActive !== false ? plan : null;
  prismaAny.$transaction = async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx);

  return { member, plan, memberships, payments, calls };
}

function lastItem<T>(items: T[]) {
  const item = items[items.length - 1];
  assert.ok(item);
  return item;
}

async function testUpdatesExistingMemberDeviceUserWhenCodeChanges() {
  const { tx, rows, updates, creates } = createDeviceUserTx([{ id: "du-old", externalId: 1, memberId: "member-1" }]);

  await memberServiceTestHooks.syncDeviceUser(tx, "member-1", "6");

  assert.deepEqual(rows, [{ id: "du-old", externalId: 6, memberId: "member-1" }]);
  assert.deepEqual(updates, [{ id: "du-old", data: { externalId: 6, memberId: "member-1" } }]);
  assert.equal(creates.length, 0);
}

async function testMovesMemberToExistingUnlinkedDeviceUser() {
  const { tx, rows, updates, creates } = createDeviceUserTx([
    { id: "du-old", externalId: 1, memberId: "member-1" },
    { id: "du-device", externalId: 6, memberId: null },
  ]);

  await memberServiceTestHooks.syncDeviceUser(tx, "member-1", "6");

  assert.deepEqual(rows, [
    { id: "du-old", externalId: 1, memberId: null },
    { id: "du-device", externalId: 6, memberId: "member-1" },
  ]);
  assert.deepEqual(updates, [
    { id: "du-old", data: { memberId: null } },
    { id: "du-device", data: { memberId: "member-1" } },
  ]);
  assert.equal(creates.length, 0);
}

async function testLinksExistingUnlinkedDeviceUser() {
  const { tx, rows, updates, creates } = createDeviceUserTx([{ id: "du-device", externalId: 6, memberId: null }]);

  await memberServiceTestHooks.syncDeviceUser(tx, "member-1", "6");

  assert.deepEqual(rows, [{ id: "du-device", externalId: 6, memberId: "member-1" }]);
  assert.deepEqual(updates, [{ id: "du-device", data: { memberId: "member-1" } }]);
  assert.equal(creates.length, 0);
}

async function testRejectsDeviceUserLinkedToAnotherMember() {
  const { tx } = createDeviceUserTx([{ id: "du-device", externalId: 6, memberId: "member-2" }]);

  await assert.rejects(() => memberServiceTestHooks.syncDeviceUser(tx, "member-1", "6"), (error) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    assert.match(error.message, /Device user ID 6 is already linked to another member/u);
    assert.match(error.message, /Save was not completed/u);
    return true;
  });
}

async function testMemberTotalsUseLegacyPaidFallbackWhenNoLedgerPayments() {
  const tx = createMemberTotalsTx([{ totalDue: 1300, totalPaid: 500, payments: [] }]);

  const totals = await memberServiceTestHooks.calculateMemberTotalsFromLedger(tx, "member-1", {
    allowLegacyFallback: true,
  });

  assert.deepEqual(totals, {
    totalPaid: 500,
    totalDue: 1300,
    totalDebt: 800,
    creditBalance: 0,
    hasAppliedPayments: false,
  });
}

async function testMemberTotalsPreferLedgerPaymentsWhenTheyExist() {
  const tx = createMemberTotalsTx([{ totalDue: 1300, totalPaid: 500, payments: [{ amount: 700 }, { amount: 600 }] }]);

  const totals = await memberServiceTestHooks.calculateMemberTotalsFromLedger(tx, "member-1", {
    allowLegacyFallback: true,
  });

  assert.deepEqual(totals, {
    totalPaid: 1300,
    totalDue: 1300,
    totalDebt: 0,
    creditBalance: 0,
    hasAppliedPayments: true,
  });
}

async function testRenewalCreatesPendingDebtAndSyncsProfileTotals() {
  const mock = mockMembershipLifecyclePrisma([
    buildLifecycleMembership({
      id: "membership-old",
      status: MembershipStatus.EXPIRED,
      endDate: new Date("2026-04-04T00:00:00.000Z"),
      totalDue: 1300,
      totalPaid: 1300,
      payments: [{ id: "payment-old", amount: 1300 }],
    }),
  ]);

  try {
    const membership = await createMemberMembership(
      "member-1",
      {
        planId: "plan-1",
        periods: 1,
        paidAmount: 700,
        paidAt: "2026-07-08T13:29:00.000Z",
        notes: "renewal test",
      },
      membershipActionContext
    );

    const newMembership = mock.memberships.find((item) => item.id === membership.id);
    assert.ok(newMembership);
    assert.equal(newMembership.status, MembershipStatus.PENDING);
    assert.equal(newMembership.totalDue, 1300);
    assert.equal(newMembership.totalPaid, 700);
    assert.equal(mock.calls.paymentCreates.length, 1);
    assert.equal(mock.calls.paymentCreates[0].membershipId, newMembership.id);
    assert.equal(mock.calls.paymentCreates[0].amount, 700);
    assert.equal(mock.calls.paymentCreates[0].recordedByAdminId, membershipActionContext.actor.id);

    const audit = lastItem(mock.calls.auditCreates);
    assert.equal(audit.action, "membership.renewed");
    assert.equal(audit.targetType, "Membership");
    assert.equal(audit.targetId, newMembership.id);
    assert.equal(audit.actorId, membershipActionContext.actor.id);
    assert.equal(audit.afterData.totalPaid, 700);

    const profileUpsert = lastItem(mock.calls.customerProfileUpserts);
    assert.deepEqual(profileUpsert.update, {
      totalPaidAmount: 2000,
      totalDebtAmount: 600,
    });
  } finally {
    restorePrismaMocks();
  }
}

async function testBalancePaymentSettlesRenewalDebtAndSyncsProfileTotals() {
  const mock = mockMembershipLifecyclePrisma([
    buildLifecycleMembership({
      id: "membership-old",
      status: MembershipStatus.EXPIRED,
      endDate: new Date("2026-04-04T00:00:00.000Z"),
      totalDue: 1300,
      totalPaid: 1300,
      payments: [{ id: "payment-old", amount: 1300 }],
    }),
    buildLifecycleMembership({
      id: "membership-renewal",
      status: MembershipStatus.PENDING,
      startDate: new Date("2026-07-08T00:00:00.000Z"),
      endDate: new Date("2026-09-08T00:00:00.000Z"),
      totalDue: 1300,
      totalPaid: 700,
      payments: [{ id: "payment-renewal-partial", amount: 700 }],
    }),
  ]);

  try {
    const payment = await createMemberPayment(
      "member-1",
      {
        membershipId: "membership-renewal",
        amount: 600,
        paidAt: "2026-07-08T14:00:00.000Z",
        notes: "balance payment",
      },
      membershipActionContext
    );

    const renewal = mock.memberships.find((item) => item.id === "membership-renewal");
    assert.ok(renewal);
    assert.equal(payment.membershipId, "membership-renewal");
    assert.equal(payment.amount, 600);
    assert.equal(renewal.totalPaid, 1300);
    assert.equal(mock.calls.paymentCreates[0].recordedByAdminId, membershipActionContext.actor.id);

    const audit = lastItem(mock.calls.auditCreates);
    assert.equal(audit.action, "membership.payment.recorded");
    assert.equal(audit.targetType, "Payment");
    assert.equal(audit.targetId, payment.id);
    assert.equal(audit.beforeData.membershipTotalPaid, 700);
    assert.equal(audit.afterData.membershipTotalPaid, 1300);
    assert.equal(audit.metadata.requestedAmount, 600);
    assert.equal(audit.metadata.appliedAmount, 600);
    assert.equal(audit.metadata.creditAmount, 0);
    assert.equal(audit.metadata.paymentIds.length, 1);
    assert.equal(JSON.stringify(audit).includes("balance payment"), false);

    const profileUpsert = lastItem(mock.calls.customerProfileUpserts);
    assert.deepEqual(profileUpsert.update, {
      totalPaidAmount: 2600,
      totalDebtAmount: 0,
    });
  } finally {
    restorePrismaMocks();
  }
}

async function testOverpaymentAppliesRemainingBalanceAndCreatesCredit() {
  const mock = mockMembershipLifecyclePrisma([
    buildLifecycleMembership({
      id: "membership-renewal",
      status: MembershipStatus.PENDING,
      startDate: new Date("2026-07-08T00:00:00.000Z"),
      endDate: new Date("2026-09-08T00:00:00.000Z"),
      totalDue: 1300,
      totalPaid: 700,
      payments: [{ id: "payment-renewal-partial", amount: 700 }],
    }),
  ]);

  try {
    const payment = await createMemberPayment(
      "member-1",
      {
        membershipId: "membership-renewal",
        amount: 1000,
        paidAt: "2026-07-08T14:30:00.000Z",
        notes: "overpayment",
      },
      membershipActionContext
    );

    const renewal = mock.memberships.find((item) => item.id === "membership-renewal");
    assert.ok(renewal);
    assert.equal(payment.membershipId, "membership-renewal");
    assert.equal(payment.amount, 600);
    assert.equal(renewal.totalPaid, 1300);
    assert.equal(mock.calls.paymentCreates.length, 2);
    assert.equal(mock.calls.paymentCreates[0].membershipId, "membership-renewal");
    assert.equal(mock.calls.paymentCreates[0].amount, 600);
    assert.equal(mock.calls.paymentCreates[0].recordedByAdminId, membershipActionContext.actor.id);
    assert.equal(mock.calls.paymentCreates[1].membershipId, null);
    assert.equal(mock.calls.paymentCreates[1].amount, 400);
    assert.equal(mock.calls.paymentCreates[1].recordedByAdminId, membershipActionContext.actor.id);
    assert.match(mock.calls.paymentCreates[1].notes, /Member credit/u);

    const audit = lastItem(mock.calls.auditCreates);
    assert.equal(audit.action, "membership.payment.recorded");
    assert.equal(audit.targetId, payment.id);
    assert.equal(audit.beforeData.memberTotalDebt, 600);
    assert.equal(audit.afterData.memberTotalDebt, 0);
    assert.equal(audit.afterData.memberCreditBalance, 400);
    assert.equal(audit.metadata.requestedAmount, 1000);
    assert.equal(audit.metadata.appliedAmount, 600);
    assert.equal(audit.metadata.creditAmount, 400);
    assert.equal(audit.metadata.paymentIds.length, 2);
    assert.equal(audit.metadata.ledgerEntries.length, 2);
    assert.equal(JSON.stringify(audit).includes("overpayment"), false);

    const profileUpsert = lastItem(mock.calls.customerProfileUpserts);
    assert.deepEqual(profileUpsert.update, {
      totalPaidAmount: 1300,
      totalDebtAmount: 0,
    });
  } finally {
    restorePrismaMocks();
  }
}

async function testCancellationRefundsLedgerAndClearsProfileDebt() {
  const mock = mockMembershipLifecyclePrisma([
    buildLifecycleMembership({
      id: "membership-cancel",
      status: MembershipStatus.PENDING,
      startDate: new Date("2026-07-08T00:00:00.000Z"),
      endDate: new Date("2026-09-08T00:00:00.000Z"),
      totalDue: 1300,
      totalPaid: 700,
      payments: [{ id: "payment-partial", amount: 700 }],
    }),
  ]);

  try {
    const result = await cancelMemberMembership(
      "member-1",
      "membership-cancel",
      {
        refundAt: "2026-07-08T15:00:00.000Z",
        notes: "customer requested cancellation",
      },
      membershipActionContext
    );

    const cancelled = mock.memberships.find((item) => item.id === "membership-cancel");
    assert.ok(cancelled);
    assert.equal(result.refundedAmount, 700);
    assert.equal(cancelled.status, MembershipStatus.CANCELLED);
    assert.equal(cancelled.totalDue, 0);
    assert.equal(cancelled.totalPaid, 0);
    assert.equal(mock.calls.paymentCreates.length, 1);
    assert.equal(mock.calls.paymentCreates[0].membershipId, "membership-cancel");
    assert.equal(mock.calls.paymentCreates[0].amount, -700);
    assert.equal(mock.calls.paymentCreates[0].recordedByAdminId, membershipActionContext.actor.id);
    assert.match(mock.calls.paymentCreates[0].notes, /Membership cancellation refund/u);

    const audit = lastItem(mock.calls.auditCreates);
    assert.equal(audit.action, "membership.cancelled");
    assert.equal(audit.targetId, "membership-cancel");
    assert.equal(audit.beforeData.status, MembershipStatus.PENDING);
    assert.equal(audit.afterData.status, MembershipStatus.CANCELLED);
    assert.equal(audit.metadata.refundedAmount, 700);

    const profileUpsert = lastItem(mock.calls.customerProfileUpserts);
    assert.deepEqual(profileUpsert.update, {
      totalPaidAmount: 0,
      totalDebtAmount: 0,
    });
  } finally {
    restorePrismaMocks();
  }
}

async function run() {
  const tests = [
    { name: "updates existing member DeviceUser when code changes", execute: testUpdatesExistingMemberDeviceUserWhenCodeChanges },
    { name: "moves member to existing unlinked DeviceUser", execute: testMovesMemberToExistingUnlinkedDeviceUser },
    { name: "links existing unlinked DeviceUser", execute: testLinksExistingUnlinkedDeviceUser },
    { name: "rejects DeviceUser linked to another member", execute: testRejectsDeviceUserLinkedToAnotherMember },
    {
      name: "member totals use legacy paid fallback when no ledger payments exist",
      execute: testMemberTotalsUseLegacyPaidFallbackWhenNoLedgerPayments,
    },
    {
      name: "member totals prefer ledger payments when they exist",
      execute: testMemberTotalsPreferLedgerPaymentsWhenTheyExist,
    },
    {
      name: "renewal creates pending debt and syncs profile totals",
      execute: testRenewalCreatesPendingDebtAndSyncsProfileTotals,
    },
    {
      name: "balance payment settles renewal debt and syncs profile totals",
      execute: testBalancePaymentSettlesRenewalDebtAndSyncsProfileTotals,
    },
    {
      name: "overpayment applies remaining balance and creates credit",
      execute: testOverpaymentAppliesRemainingBalanceAndCreatesCredit,
    },
    {
      name: "cancellation refunds ledger and clears profile debt",
      execute: testCancellationRefundsLedgerAndClearsProfileDebt,
    },
  ];

  for (const test of tests) {
    await test.execute();
    console.log(`ok - ${test.name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
