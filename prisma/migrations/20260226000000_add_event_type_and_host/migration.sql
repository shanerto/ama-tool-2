-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('company', 'team');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "type" "EventType" NOT NULL DEFAULT 'team';
ALTER TABLE "events" ADD COLUMN "hostName" TEXT;
ALTER TABLE "events" ADD COLUMN "createdByUserId" TEXT;
