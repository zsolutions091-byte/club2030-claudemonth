-- AlterTable
ALTER TABLE "Task" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Task_archivedAt_idx" ON "Task"("archivedAt");
