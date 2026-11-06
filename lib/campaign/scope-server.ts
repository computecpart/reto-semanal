import "server-only";

import { headers } from "next/headers";

import { CAMPAIGN_HEADER, campaignBase, isCampaignSlug } from "./scope";

/** Private campaign requested by the current URL, or null for the main one. */
export async function getCampaignSlug(): Promise<string | null> {
  const slug = (await headers()).get(CAMPAIGN_HEADER);
  return isCampaignSlug(slug) ? slug : null;
}

export async function getCampaignBase(): Promise<string> {
  return campaignBase(await getCampaignSlug());
}
