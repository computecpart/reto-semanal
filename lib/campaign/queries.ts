import "server-only";

import { readLandingContent, type LandingContent } from "@/lib/landing/schema";
import { createClient } from "@/lib/supabase/server";

import { isCampaignStatus, type CampaignStatus } from "./status";

export interface PublicCampaign {
  ends_at: string | null;
  name: string;
  prize_description: string | null;
  prize_title: string | null;
  slug: string;
  starts_at: string | null;
  status: CampaignStatus;
}

export interface PublicLanding {
  campaign: PublicCampaign;
  landing: LandingContent | null;
  rulesVersion: number | null;
}

export async function getPublicLanding(): Promise<PublicLanding | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_landing");

  if (error) {
    throw new Error("No fue posible cargar la campaña.");
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const raw = data as { campaign?: PublicCampaign; landing?: unknown; rules_version?: number | null };

  if (!raw.campaign || !isCampaignStatus(raw.campaign.status)) {
    return null;
  }

  return {
    campaign: raw.campaign,
    landing: raw.landing ? readLandingContent(raw.landing) : null,
    rulesVersion: raw.rules_version ?? null,
  };
}

export interface CurrentRules {
  campaign_name: string;
  content_md: string;
  is_major: boolean;
  published_at: string;
  version: number;
}

export async function getCurrentRules(): Promise<CurrentRules | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_current_rules").maybeSingle<CurrentRules>();

  if (error) {
    throw new Error("No fue posible cargar las reglas.");
  }

  return data;
}

export async function getMyRulesStatus(): Promise<{ required: boolean; latest_version?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_rules_status");

  if (error || !data || typeof data !== "object") {
    // Fail open only for the gate UI; acceptance itself is enforced server-side.
    return { required: false };
  }

  return data as { required: boolean; latest_version?: number };
}

export interface AdminCampaign extends PublicCampaign {
  created_at: string;
  id: string;
  updated_at: string;
}

const ADMIN_CAMPAIGN_COLUMNS =
  "id, slug, name, status, starts_at, ends_at, prize_title, prize_description, created_at, updated_at";

// Admin reads rely on RLS policies that require public.is_admin().
export async function getAdminCampaigns(): Promise<AdminCampaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(ADMIN_CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<AdminCampaign[]>();

  if (error) {
    throw new Error("No fue posible cargar las campañas.");
  }

  return data ?? [];
}

export async function getAdminCampaign(id: string): Promise<AdminCampaign | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(ADMIN_CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle<AdminCampaign>();

  if (error) {
    throw new Error("No fue posible cargar la campaña.");
  }

  return data;
}

export interface AdminLanding {
  draft: LandingContent;
  draftUpdatedAt: string;
  publishedAt: string | null;
  publishedVersion: number;
  versions: { published_at: string; version: number }[];
}

export async function getAdminLanding(campaignId: string): Promise<AdminLanding | null> {
  const supabase = await createClient();
  const [landing, versions] = await Promise.all([
    supabase
      .from("landing_pages")
      .select("draft, draft_updated_at, published_at, published_version")
      .eq("campaign_id", campaignId)
      .maybeSingle<{
        draft: unknown;
        draft_updated_at: string;
        published_at: string | null;
        published_version: number;
      }>(),
    supabase
      .from("landing_page_versions")
      .select("version, published_at")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(20)
      .returns<{ published_at: string; version: number }[]>(),
  ]);

  if (landing.error || versions.error) {
    throw new Error("No fue posible cargar la portada.");
  }

  if (!landing.data) {
    return null;
  }

  return {
    draft: readLandingContent(landing.data.draft),
    draftUpdatedAt: landing.data.draft_updated_at,
    publishedAt: landing.data.published_at,
    publishedVersion: landing.data.published_version,
    versions: versions.data ?? [],
  };
}

export interface AdminRulesVersion {
  change_summary: string | null;
  content_md: string;
  is_major: boolean;
  published_at: string;
  version: number;
}

export async function getAdminRulesVersions(campaignId: string): Promise<AdminRulesVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_rules_versions")
    .select("version, content_md, change_summary, is_major, published_at")
    .eq("campaign_id", campaignId)
    .order("version", { ascending: false })
    .returns<AdminRulesVersion[]>();

  if (error) {
    throw new Error("No fue posible cargar las reglas.");
  }

  return data ?? [];
}
