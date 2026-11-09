import { campaignBase, isCampaignSlug } from "./scope";

export const CHOOSER_PATH = "/elegir-campana";

/** Remembers the campaign picked in the chooser, so entering again asks again only after a while. */
export const CHOICE_COOKIE = "campaign_choice";
export const CHOICE_MAX_AGE_SECONDS = 6 * 60 * 60;

/** Only the panel of the main campaign or of one campaign slug; anything else is rejected. */
export function chosenDestination(value: unknown): string | null {
  if (value === "/app") {
    return value;
  }

  if (typeof value === "string" && value.startsWith("/c/") && isCampaignSlug(value.slice(3))) {
    return value;
  }

  return null;
}

export interface CampaignChoice {
  href: string;
  name: string;
  /** null = the main (public) campaign. */
  slug: string | null;
}

export interface CampaignChoices {
  /** Main campaign for invited accounts that are not part of it yet. */
  joinableMain: string | null;
  /** True when the person has something to choose: more than one campaign, or joining the main one. */
  mustChoose: boolean;
  options: CampaignChoice[];
}

/**
 * Campaigns a session can enter. Only people who joined a private campaign with
 * its link get more than one; everyone else goes straight to the main campaign.
 */
export function campaignChoices(mine: {
  campaigns: readonly { name: string; slug: string }[];
  primaryName: string | null;
  privateOnly: boolean;
}): CampaignChoices {
  const options: CampaignChoice[] = [
    ...(!mine.privateOnly && mine.primaryName ? [{ href: "/app", name: mine.primaryName, slug: null }] : []),
    ...mine.campaigns.map((campaign) => ({
      href: campaignBase(campaign.slug),
      name: campaign.name,
      slug: campaign.slug,
    })),
  ];
  const joinableMain = mine.privateOnly ? mine.primaryName : null;

  return {
    joinableMain,
    mustChoose: options.length > 1 || (joinableMain !== null && options.length > 0),
    options,
  };
}
