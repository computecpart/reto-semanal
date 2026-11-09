import { campaignBase } from "./scope";

export const CHOOSER_PATH = "/elegir-campana";

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
