import "server-only";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export interface AdminMissionSummary {
  code: string | null;
  enabled: boolean;
  expires_at: string;
  id: string;
  name: string;
  points: number;
  redemption_count: number;
  starts_at: string;
}

export async function getAdminMissions(): Promise<AdminMissionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_rewards");

  if (error) {
    throw new Error("No fue posible cargar las misiones.");
  }

  return ((data ?? []) as AdminMissionSummary[]).map((row) => ({ ...row, redemption_count: Number(row.redemption_count) }));
}

export interface AdminMission {
  code: string | null;
  description: string;
  enabled: boolean;
  expires_at: string;
  id: string;
  name: string;
  points: number;
  redemptions: { alias: string; channel: string; full_name: string; passport_code: string; redeemed_at: string }[];
  starts_at: string;
}

export async function getAdminMission(id: string): Promise<AdminMission | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_reward", { p_reward_id: id });

  if (error) {
    throw new Error("No fue posible cargar la misión.");
  }

  return (data as AdminMission | null) ?? null;
}

const PRODUCTION_ORIGIN = "https://piensads.app";
const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Origin printed inside QR codes. Never derived freely from request headers:
 * only the production domain, or localhost while developing.
 */
export async function getSiteOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  return host === "localhost:3000" ? LOCAL_ORIGIN : PRODUCTION_ORIGIN;
}
