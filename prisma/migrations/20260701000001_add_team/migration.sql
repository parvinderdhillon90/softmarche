CREATE TYPE "TeamRole" AS ENUM ('ADMIN', 'MEMBER');

CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");

CREATE TABLE "AccountAssignment" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountAssignment_teamMemberId_accountId_key" ON "AccountAssignment"("teamMemberId", "accountId");

ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_teamMemberId_fkey"
    FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountAssignment" ADD CONSTRAINT "AccountAssignment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
