import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

type MembershipRow = {
  id: string;
  memberId: string;
  totalPaid: unknown;
  startDate: Date;
  createdAt: Date;
};

type BackfillCandidate = {
  membershipId: string;
  memberId: string;
  amount: number;
  paidAt: Date;
};

const LEGACY_REFERENCE = "LEGACY-OPENING-BALANCE";
const LEGACY_NOTES = "Backfilled from legacy totals";

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const memberships = await prisma.membership.findMany({
    where: {
      totalPaid: { gt: 0 },
      payments: { none: {} },
    },
    select: {
      id: true,
      memberId: true,
      totalPaid: true,
      startDate: true,
      createdAt: true,
    },
  });

  const candidates: BackfillCandidate[] = [];
  let skippedForMemberPayments = 0;

  for (const membership of memberships as MembershipRow[]) {
    const memberPayments = await prisma.payment.count({ where: { memberId: membership.memberId } });
    if (memberPayments > 0) {
      skippedForMemberPayments += 1;
      continue;
    }
    const amount = roundCurrency(Number(membership.totalPaid ?? 0));
    if (amount <= 0) {
      continue;
    }
    candidates.push({
      membershipId: membership.id,
      memberId: membership.memberId,
      amount,
      paidAt: membership.createdAt ?? membership.startDate,
    });
  }

  const distinctMembers = new Set(candidates.map((c) => c.memberId));

  console.log("[backfill] dryRun=", dryRun);
  console.log("[backfill] memberships (totalPaid>0, no membership payments):", memberships.length);
  console.log("[backfill] skipped (member already has payments):", skippedForMemberPayments);
  console.log("[backfill] memberships to backfill:", candidates.length);
  console.log("[backfill] members to backfill:", distinctMembers.size);

  if (dryRun || candidates.length === 0) {
    return;
  }

  for (const candidate of candidates) {
    await prisma.payment.create({
      data: {
        memberId: candidate.memberId,
        membershipId: candidate.membershipId,
        amount: candidate.amount,
        currency: "AFN",
        method: PaymentMethod.CASH,
        status: PaymentStatus.PAID,
        paidAt: candidate.paidAt,
        reference: LEGACY_REFERENCE,
        notes: LEGACY_NOTES,
        recordedByAdminId: null,
      },
    });
  }

  console.log("[backfill] created payments:", candidates.length);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

main()
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (process.exitCode === undefined) {
      process.exit(0);
    }
  });
