export const CAMPAIGN_STATUSES = [
  "draft",
  "published",
  "closed",
  "finalized",
  "archived",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  archived: "Archivada",
  closed: "Cerrada",
  draft: "Borrador",
  finalized: "Finalizada",
  published: "Publicada",
};

// Mirrors admin_set_campaign_status; PostgreSQL remains the authority.
const TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  archived: [],
  closed: ["published", "finalized"],
  draft: ["published", "archived"],
  finalized: ["archived"],
  published: ["closed"],
};

export function getAllowedTransitions(status: CampaignStatus): readonly CampaignStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && CAMPAIGN_STATUSES.some((status) => status === value);
}

export const CAMPAIGN_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
