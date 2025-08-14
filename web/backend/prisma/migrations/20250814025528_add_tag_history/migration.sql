-- CreateTable
CREATE TABLE "public"."TagHistory" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "tags" TEXT[],
    "existingTags" TEXT[],
    "newTags" TEXT[],
    "prompt" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TagHistory_noteId_idx" ON "public"."TagHistory"("noteId");

-- CreateIndex
CREATE INDEX "TagHistory_createdAt_idx" ON "public"."TagHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."TagHistory" ADD CONSTRAINT "TagHistory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "public"."Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
