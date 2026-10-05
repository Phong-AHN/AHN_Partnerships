/**
 * Domain vocabulary. Declared here as plain string unions - not imported from
 * the Prisma client - so client components and the design system can share one
 * definition without pulling a database driver into a bundle. `packages/db`
 * asserts at typecheck time that these stay in step with the schema.
 */

export const USER_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Which side of the house a deal is for: AHN, the AHN Foundation, or both. */
export const ENTITIES = ['AHN', 'AHNF', 'BOTH'] as const;
export type Entity = (typeof ENTITIES)[number];

export const SECTORS = [
  'BANKING_FINANCIAL',
  'TECH_COMMERCE_SMB',
  'PROFESSIONAL_SERVICES',
  'CORPORATE_CONSUMER_MEDIA',
  'GLOBAL_GOVERNMENT_ECOSYSTEM',
] as const;
export type Sector = (typeof SECTORS)[number];

export const PRIORITIES = ['IN_MOTION', 'NEXT_OUTREACH', 'OPPORTUNITY', 'BACKLOG'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** What we are asking a partner for. The ask varies by relationship. */
export const ASK_TYPES = [
  'CORPORATE_MEMBERSHIP',
  'REFERRAL_REVENUE',
  'STRATEGIC_COMMUNITY',
] as const;
export type AskType = (typeof ASK_TYPES)[number];

export const DEAL_STAGES = [
  'PROSPECT',
  'CONTACTED',
  'IN_DISCUSSION',
  'PROPOSAL_SENT',
  'NEGOTIATING',
  'WON',
  'LOST',
  'ON_HOLD',
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const ACTIVITY_TYPES = [
  'NOTE',
  'EMAIL',
  'CALL',
  'MEETING',
  'STAGE_CHANGE',
  'DEAL_CREATED',
  'MEMBERSHIP_STARTED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** The activity types a person logs by hand; the rest are written by the system. */
export const LOGGABLE_ACTIVITY_TYPES = ['NOTE', 'EMAIL', 'CALL', 'MEETING'] as const;
export type LoggableActivityType = (typeof LOGGABLE_ACTIVITY_TYPES)[number];
