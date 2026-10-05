-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Entity" AS ENUM ('AHN', 'AHNF', 'BOTH');

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('BANKING_FINANCIAL', 'TECH_COMMERCE_SMB', 'PROFESSIONAL_SERVICES', 'CORPORATE_CONSUMER_MEDIA', 'GLOBAL_GOVERNMENT_ECOSYSTEM');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('IN_MOTION', 'NEXT_OUTREACH', 'OPPORTUNITY', 'BACKLOG');

-- CreateEnum
CREATE TYPE "AskType" AS ENUM ('CORPORATE_MEMBERSHIP', 'REFERRAL_REVENUE', 'STRATEGIC_COMMUNITY');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('PROSPECT', 'CONTACTED', 'IN_DISCUSSION', 'PROPOSAL_SENT', 'NEGOTIATING', 'WON', 'LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'EMAIL', 'CALL', 'MEETING', 'STAGE_CHANGE', 'DEAL_CREATED', 'MEMBERSHIP_STARTED');

-- CreateEnum
CREATE TYPE "PasswordTokenPurpose" AS ENUM ('INVITE', 'RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "PasswordTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignInThrottle" (
    "ip" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SignInThrottle_pkey" PRIMARY KEY ("ip")
);

-- CreateTable
CREATE TABLE "MembershipTier" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "benefits" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MembershipTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "sector" "Sector" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'BACKLOG',
    "existingRelationship" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "ownerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedin" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2027,
    "entity" "Entity" NOT NULL DEFAULT 'AHN',
    "askType" "AskType" NOT NULL,
    "tierId" UUID,
    "amountMinor" INTEGER,
    "stage" "DealStage" NOT NULL DEFAULT 'PROSPECT',
    "stageChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCloseDate" DATE,
    "closedAt" TIMESTAMPTZ(3),
    "lostReason" TEXT,
    "nextAction" TEXT,
    "nextActionDue" DATE,
    "ownerId" UUID,
    "proposalUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "tierId" UUID NOT NULL,
    "dealId" UUID,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "paidAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "dealId" UUID,
    "type" "ActivityType" NOT NULL,
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" UUID,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordToken_tokenHash_key" ON "PasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordToken_userId_idx" ON "PasswordToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordToken_expiresAt_idx" ON "PasswordToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SignInThrottle_lastAttemptAt_idx" ON "SignInThrottle"("lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTier_code_key" ON "MembershipTier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTier_name_year_key" ON "MembershipTier"("name", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_name_key" ON "Partner"("name");

-- CreateIndex
CREATE INDEX "Partner_sector_idx" ON "Partner"("sector");

-- CreateIndex
CREATE INDEX "Partner_priority_idx" ON "Partner"("priority");

-- CreateIndex
CREATE INDEX "PartnerContact_partnerId_idx" ON "PartnerContact"("partnerId");

-- CreateIndex
CREATE INDEX "Deal_partnerId_idx" ON "Deal"("partnerId");

-- CreateIndex
CREATE INDEX "Deal_stage_idx" ON "Deal"("stage");

-- CreateIndex
CREATE INDEX "Deal_year_stage_idx" ON "Deal"("year", "stage");

-- CreateIndex
CREATE INDEX "Deal_nextActionDue_idx" ON "Deal"("nextActionDue");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_dealId_key" ON "Membership"("dealId");

-- CreateIndex
CREATE INDEX "Membership_partnerId_idx" ON "Membership"("partnerId");

-- CreateIndex
CREATE INDEX "Membership_endDate_idx" ON "Membership"("endDate");

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex
CREATE INDEX "Activity_partnerId_occurredAt_idx" ON "Activity"("partnerId", "occurredAt");

-- CreateIndex
CREATE INDEX "Activity_dealId_idx" ON "Activity"("dealId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordToken" ADD CONSTRAINT "PasswordToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Check constraints. Every one of these is also checked in the server action
-- first (ValidationError with fieldErrors); these are the last safety net,
-- never the place a user hears about a problem.
-- ---------------------------------------------------------------------------

-- A membership deal names its tier (and carries the snapshotted price) from
-- the proposal onwards. Early on that is unknown, so it is allowed to be empty.
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_membership_needs_tier"
  CHECK (
    "askType" <> 'CORPORATE_MEMBERSHIP'
    OR "stage" IN ('PROSPECT', 'CONTACTED', 'IN_DISCUSSION', 'LOST', 'ON_HOLD')
    OR ("tierId" IS NOT NULL AND "amountMinor" IS NOT NULL)
  );

-- A closed deal says when it closed.
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_closed_has_timestamp"
  CHECK ("stage" NOT IN ('WON', 'LOST') OR "closedAt" IS NOT NULL);

ALTER TABLE "Deal" ADD CONSTRAINT "Deal_amount_non_negative"
  CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_end_after_start"
  CHECK ("endDate" > "startDate");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_amount_non_negative"
  CHECK ("amountMinor" >= 0);

ALTER TABLE "MembershipTier" ADD CONSTRAINT "MembershipTier_price_non_negative"
  CHECK ("priceMinor" >= 0);
