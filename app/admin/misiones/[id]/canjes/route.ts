import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getAdminMission } from "@/lib/missions/queries";
import { isAdministrativeRole } from "@/lib/permissions/roles";

// Neutralizes spreadsheet formula injection and escapes CSV quoting.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();

  if (!context || !isAdministrativeRole(context.role)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { id } = await params;
  // admin_get_reward re-checks the role in PostgreSQL.
  const mission = await getAdminMission(id);

  if (!mission) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const rows = [
    ["alias", "nombre", "pasaporte", "canal", "canjeado_en_utc"],
    ...mission.redemptions.map((r) => [r.alias, r.full_name, r.passport_code, r.channel, r.redeemed_at]),
  ];
  const csv = `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="canjes-${id}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
