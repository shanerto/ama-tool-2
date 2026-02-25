-- AlterTable
ALTER TABLE "questions" ADD COLUMN "submitterId" TEXT;
ALTER TABLE "questions" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "questions" ADD COLUMN "pinnedAt" TIMESTAMP(3);
