/*
  Warnings:

  - Made the column `userId` on table `Note` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Note" ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "date" SET DATA TYPE TIMESTAMP;
