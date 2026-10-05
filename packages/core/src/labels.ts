import type {
  ActivityType,
  AskType,
  DealStage,
  Entity,
  MembershipStatus,
  Priority,
  Sector,
  UserRole,
} from './enums';

/**
 * How every enum value reads on screen. Screens never re-decide a label or a
 * colour: they render the descriptor decided here, so "Proposal sent" looks
 * the same on the board, the table, the partner page and the dashboard.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'muted';

export interface Descriptor {
  label: string;
  tone: Tone;
  /** One line, shown in tooltips and empty states. */
  hint?: string;
}

export const USER_ROLE_LABEL: Record<UserRole, Descriptor> = {
  ADMIN: {
    label: 'Admin',
    tone: 'accent',
    hint: 'Everything, plus tiers, users, import and settings.',
  },
  MEMBER: { label: 'Member', tone: 'info', hint: 'Works the pipeline: partners, deals, notes.' },
  VIEWER: { label: 'Viewer', tone: 'muted', hint: 'Read-only.' },
};

export const ENTITY_LABEL: Record<Entity, Descriptor> = {
  AHN: { label: 'AHN', tone: 'accent' },
  AHNF: { label: 'AHNF', tone: 'info', hint: 'AHN Foundation' },
  BOTH: { label: 'AHN + AHNF', tone: 'neutral' },
};

export const SECTOR_LABEL: Record<Sector, Descriptor> = {
  BANKING_FINANCIAL: { label: 'Banking / Financial', tone: 'info' },
  TECH_COMMERCE_SMB: { label: 'Tech / Commerce / SMB', tone: 'accent' },
  PROFESSIONAL_SERVICES: { label: 'Professional services', tone: 'neutral' },
  CORPORATE_CONSUMER_MEDIA: { label: 'Corporate / Consumer / Media', tone: 'warning' },
  GLOBAL_GOVERNMENT_ECOSYSTEM: { label: 'Global / Government / Ecosystem', tone: 'success' },
};

export const PRIORITY_LABEL: Record<Priority, Descriptor> = {
  IN_MOTION: { label: 'In motion', tone: 'danger', hint: 'Already moving - follow up now.' },
  NEXT_OUTREACH: { label: 'Next outreach', tone: 'warning', hint: 'Reach out next.' },
  OPPORTUNITY: { label: 'Opportunity', tone: 'info', hint: 'Bigger opportunity worth a plan.' },
  BACKLOG: { label: 'Backlog', tone: 'muted' },
};

export const ASK_TYPE_LABEL: Record<AskType, Descriptor> = {
  CORPORATE_MEMBERSHIP: {
    label: 'Corporate membership',
    tone: 'accent',
    hint: 'A membership tier at a fixed price.',
  },
  REFERRAL_REVENUE: {
    label: 'Referral / revenue',
    tone: 'success',
    hint: 'Referral or revenue-share partnership.',
  },
  STRATEGIC_COMMUNITY: {
    label: 'Strategic / community',
    // Not 'info': next to the accent of a membership it reads as the same blue.
    tone: 'warning',
    hint: 'Programming, events, media or ecosystem collaboration.',
  },
};

/** Short form for chips on dense cards. */
export const ASK_TYPE_SHORT: Record<AskType, string> = {
  CORPORATE_MEMBERSHIP: 'Membership',
  REFERRAL_REVENUE: 'Referral',
  STRATEGIC_COMMUNITY: 'Strategic',
};

export const DEAL_STAGE_LABEL: Record<DealStage, Descriptor> = {
  PROSPECT: { label: 'Prospect', tone: 'muted', hint: 'Identified, not contacted yet.' },
  CONTACTED: { label: 'Contacted', tone: 'neutral', hint: 'First touch made.' },
  IN_DISCUSSION: { label: 'In discussion', tone: 'info', hint: 'Talking about what fits.' },
  PROPOSAL_SENT: { label: 'Proposal sent', tone: 'accent', hint: 'A concrete ask is with them.' },
  NEGOTIATING: { label: 'Negotiating', tone: 'warning', hint: 'Working out the terms.' },
  WON: { label: 'Won', tone: 'success', hint: 'Signed.' },
  LOST: { label: 'Lost', tone: 'danger', hint: 'Not this year.' },
  ON_HOLD: { label: 'On hold', tone: 'muted', hint: 'Paused, not dead.' },
};

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, Descriptor> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, Descriptor> = {
  NOTE: { label: 'Note', tone: 'neutral' },
  EMAIL: { label: 'Email', tone: 'info' },
  CALL: { label: 'Call', tone: 'accent' },
  MEETING: { label: 'Meeting', tone: 'success' },
  STAGE_CHANGE: { label: 'Stage change', tone: 'warning' },
  DEAL_CREATED: { label: 'Deal created', tone: 'accent' },
  MEMBERSHIP_STARTED: { label: 'Membership started', tone: 'success' },
};
