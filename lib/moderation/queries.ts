import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ParticipantRow {
  age: number | null;
  alias: string;
  avatar_id: string | null;
  department: string | null;
  email: string;
  first_name: string;
  is_adult: boolean | null;
  last_name: string;
  passport_code: string;
  phone: string | null;
  points: number;
  registered_at: string;
  role: string;
  status: string;
  total_count: number;
  user_id: string;
}

export interface ParticipantFilters {
  age: string;
  department: string;
  page: number;
  query: string;
  role: string;
  status: string;
}

export const PAGE_SIZE = 25;

export async function listParticipants(filters: ParticipantFilters): Promise<ParticipantRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_participants", {
    p_age: filters.age,
    p_department: filters.department,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
    p_query: filters.query,
    p_role: filters.role,
    p_status: filters.status,
  });

  if (error) {
    throw new Error("No fue posible cargar los participantes.");
  }

  return ((data ?? []) as ParticipantRow[]).map((row) => ({ ...row, points: Number(row.points), total_count: Number(row.total_count) }));
}

export async function listBlockedTerms() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_blocked_terms");

  if (error) {
    throw new Error("No fue posible cargar los términos.");
  }

  return (data ?? []) as { active: boolean; category: string; created_at: string; term: string }[];
}

export async function listAliasConflicts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_alias_conflicts");

  if (error) {
    throw new Error("No fue posible revisar los alias.");
  }

  return (data ?? []) as { alias: string; full_name: string; passport_code: string; user_id: string }[];
}

export async function listStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_staff");

  if (error) {
    throw new Error("No fue posible cargar el equipo administrador.");
  }

  return (data ?? []) as { alias: string | null; email: string; full_name: string | null; role: string; user_id: string }[];
}

export interface AuditEntry {
  action: string;
  actor_alias: string | null;
  actor_role: string | null;
  after: unknown;
  before: unknown;
  entity_id: string | null;
  entity_type: string;
  occurred_at: string;
  reason: string | null;
}

export async function listAudit(filters: { action: string; entity: string; from: string | null; page: number; to: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_audit", {
    p_action: filters.action,
    p_entity: filters.entity,
    p_from: filters.from,
    p_limit: 50,
    p_offset: (filters.page - 1) * 50,
    p_to: filters.to,
  });

  if (error) {
    throw new Error("No fue posible cargar la auditoría.");
  }

  return (data ?? []) as AuditEntry[];
}

export interface RaffleDraw {
  drawn_at: string;
  eligible_count: number;
  eligible_hash: string;
  id: number;
  public_seed: string;
  winners: { alias: string | null; passport_code: string; position: number }[];
}

export async function getRafflePreview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_raffle_preview");

  if (error) {
    throw new Error("No fue posible cargar la rifa.");
  }

  return data as { draws: RaffleDraw[]; eligible_codes: string[]; eligible_count: number; eligible_hash: string };
}

export async function getDisqualifiedParticipants() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_disqualified_participants");
  return (data ?? []) as { alias: string; avatar_id: string | null; passport_hint: string }[];
}
