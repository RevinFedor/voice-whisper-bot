-- DropForeignKey (if exists)
ALTER TABLE "public"."Note" DROP CONSTRAINT IF EXISTS "Note_userId_fkey";

-- AlterTable - make userId optional with default value
ALTER TABLE "public"."Note" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "public"."Note" ALTER COLUMN "userId" SET DEFAULT 'local';

-- Drop User table if it still exists
DROP TABLE IF EXISTS "public"."User" CASCADE;