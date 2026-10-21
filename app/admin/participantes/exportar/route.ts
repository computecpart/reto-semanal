import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

// Neutralizes spreadsheet formula injection and escapes CSV quoting.
function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Personal data export: superadmin only; the RPC re-checks and audits it.
export async function GET() {
  const context = await getAuthContext();

  if (context?.role !== "superadmin") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_export_participants");

  if (error) {
    return new NextResponse("No fue posible exportar", { status: 500 });
  }

  const columns = [
    "alias", "first_name", "last_name", "email", "phone", "department", "birth_date",
    "passport_code", "status", "role", "marketing_consent", "points", "registered_at",
  ];
  const rows = (data ?? []) as Record<string, unknown>[];
  const csv = `﻿${[columns.map(cell).join(","), ...rows.map((row) => columns.map((column) => cell(row[column])).join(","))].join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="participantes.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
