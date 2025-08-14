-- DropForeignKey
ALTER TABLE "public"."Note" DROP CONSTRAINT "Note_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TitleHistory" DROP CONSTRAINT IF EXISTS "TitleHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TagHistory" DROP CONSTRAINT IF EXISTS "TagHistory_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Note" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "public"."Note" ALTER COLUMN "userId" SET DEFAULT 'local';

-- DropTable
DROP TABLE IF EXISTS "public"."User";