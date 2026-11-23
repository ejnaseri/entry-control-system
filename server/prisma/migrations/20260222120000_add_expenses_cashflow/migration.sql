-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'POSTED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "reference" TEXT,
    "vendorName" TEXT,
    "isAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfExpenseId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_slug_key" ON "ExpenseCategory"("slug");

-- CreateIndex
CREATE INDEX "ExpenseCategory_isActive_sortOrder_idx" ON "ExpenseCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_reversalOfExpenseId_key" ON "Expense"("reversalOfExpenseId");

-- CreateIndex
CREATE INDEX "Expense_categoryId_occurredAt_idx" ON "Expense"("categoryId", "occurredAt");

-- CreateIndex
CREATE INDEX "Expense_status_occurredAt_idx" ON "Expense"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "Expense_occurredAt_idx" ON "Expense"("occurredAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reversalOfExpenseId_fkey" FOREIGN KEY ("reversalOfExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed defaults
INSERT INTO "ExpenseCategory" ("id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
  ('expcat_rent', 'Rent', 'rent', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_utilities', 'Utilities', 'utilities', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_internet', 'Internet', 'internet', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_cleaning', 'Cleaning', 'cleaning', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_equipment', 'Equipment', 'equipment', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_maintenance', 'Maintenance', 'maintenance', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('expcat_miscellaneous', 'Miscellaneous', 'miscellaneous', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
