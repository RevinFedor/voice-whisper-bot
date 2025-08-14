-- CreateEnum
CREATE TYPE "public"."TitleType" AS ENUM ('manual', 'ai');

-- CreateTable
CREATE TABLE "public"."TitleHistory" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "public"."TitleType" NOT NULL DEFAULT 'manual',
    "prompt" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TitleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TitleHistory_noteId_idx" ON "public"."TitleHistory"("noteId");

-- CreateIndex
CREATE INDEX "TitleHistory_createdAt_idx" ON "public"."TitleHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."TitleHistory" ADD CONSTRAINT "TitleHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
