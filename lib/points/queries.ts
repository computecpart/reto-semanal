import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import type { RankingAudience, RankingIdentity } from "./config";

export interface RankingRow {
  alias: string | null;
  avatar_id: string | null;
  correct_answers: number;
  display_name: string | null;
  events_completed: number;
  is_current_user: boolean;
  passport_hint: string | null;
  points: number;
  standing: number;
}

export interface RankingSettings {
  audience: RankingAudience;
  highlight_top: number;
  provisional: boolean;
  visible: boolean;
}

export interface MyPointsEvent {
  amount: number;
  created_at: string;
  description: string;
  id: number;
  kind: string;
}

export interface MyPoints {
  events: MyPointsEvent[];
  standing: number | null;
  total: number;
}

// The RPC applies visibility and audience rules; an empty list means hidden.
export const getRanking = cache(async (limit = 500): Promise<RankingRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ranking", { p_limit: limit });

  if (error) {
    throw new Error("No fue posible cargar el ranking.");
  }

  return ((data ?? []) as RankingRow[]).map((row) => ({
    ...row,
    correct_answers: Number(row.correct_answers),
    events_completed: Number(row.events_completed),
    points: Number(row.points),
    standing: Number(row.standing),
  }));
});

export const getRankingSettings = cache(async (): Promise<RankingSettings | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_ranking_settings");

  if (error || !data || typeof data !== "object") {
    return null;
  }

  return data as RankingSettings;
});

export const getMyPoints = cache(async (): Promise<MyPoints> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_points");

  if (error) {
    throw new Error("No fue posible cargar tus puntos.");
  }

  const raw = (data ?? {}) as Partial<MyPoints>;

  return {
    events: Array.isArray(raw.events) ? raw.events : [],
    standing: raw.standing == null ? null : Number(raw.standing),
    total: Number(raw.total ?? 0),
  };
});

export const getMyParticipantStatus = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_participant_status");
  return typeof data === "string" ? data : null;
});

export interface AdminStanding {
  alias: string;
  avatar_id: string | null;
  correct_answers: number;
  events_completed: number;
  full_name: string;
  passport_code: string;
  points: number;
  standing: number;
  status: string;
  user_id: string;
}

export async function getAdminStandings(campaignId: string): Promise<AdminStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_standings", { p_campaign_id: campaignId });

  if (error) {
    throw new Error("No fue posible cargar la clasificación.");
  }

  return ((data ?? []) as AdminStanding[]).map((row) => ({
    ...row,
    correct_answers: Number(row.correct_answers),
    events_completed: Number(row.events_completed),
    points: Number(row.points),
    standing: Number(row.standing),
  }));
}

export interface AdminPointEvent {
  alias: string;
  amount: number;
  created_at: string;
  description: string;
  id: number;
  is_reversed: boolean;
  kind: string;
  reason: string | null;
}

export async function getAdminRecentEvents(campaignId: string): Promise<AdminPointEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_recent_point_events", {
    p_campaign_id: campaignId,
    p_limit: 50,
  });

  if (error) {
    throw new Error("No fue posible cargar los movimientos.");
  }

  return (data ?? []) as AdminPointEvent[];
}

export interface AdminRankingConfig {
  id: string;
  name: string;
  ranking_audience: RankingAudience;
  ranking_highlight_top: number;
  ranking_identity: RankingIdentity;
  ranking_visible: boolean;
  status: string;
}

export async function getAdminRankingConfig(campaignId: string): Promise<AdminRankingConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status, ranking_visible, ranking_audience, ranking_identity, ranking_highlight_top")
    .eq("id", campaignId)
    .maybeSingle<AdminRankingConfig>();

  if (error) {
    throw new Error("No fue posible cargar la configuración del ranking.");
  }

  return data;
}
