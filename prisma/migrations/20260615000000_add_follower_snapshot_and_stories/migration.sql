-- Add cachedStoriesCount column to Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "cachedStoriesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable FollowerSnapshot
CREATE TABLE IF NOT EXISTS "FollowerSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "followers" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FollowerSnapshot_accountId_date_idx" ON "FollowerSnapshot"("accountId", "date");

-- AddForeignKey
ALTER TABLE "FollowerSnapshot" ADD CONSTRAINT "FollowerSnapshot_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
