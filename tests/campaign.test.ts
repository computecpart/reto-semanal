import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  campaignDetailsSchema,
  isoToSalvadorLocal,
  salvadorLocalToIso,
} from "@/lib/campaign/schemas";
import {
  CAMPAIGN_STATUSES,
  canTransition,
  getAllowedTransitions,
} from "@/lib/campaign/status";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261021000000_campaigns_landing_rules.sql"),
  "utf8",
);

describe("estados de campaña", () => {
  it("las transiciones de TypeScript coinciden exactamente con las de PostgreSQL", () => {
    const sqlPairs = [
      ...migration.matchAll(
        /\('(\w+)'::public\.campaign_status, '(\w+)'::public\.campaign_status\)/g,
      ),
    ].map((match) => `${match[1]}->${match[2]}`);
    const tsPairs = CAMPAIGN_STATUSES.flatMap((from) =>
      getAllowedTransitions(from).map((to) => `${from}->${to}`),
    );

    expect(sqlPairs.length).toBeGreaterThan(0);
    expect(new Set(tsPairs)).toEqual(new Set(sqlPairs));
  });

  it("no permite saltos arbitrarios", () => {
    expect(canTransition("draft", "finalized")).toBe(false);
    expect(canTransition("archived", "published")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("closed", "published")).toBe(true);
  });
});

describe("fechas de campaña en hora de El Salvador", () => {
  it("convierte la hora local (UTC-6) a un instante UTC", () => {
    expect(salvadorLocalToIso("2026-10-23T08:00")).toBe("2026-10-23T14:00:00.000Z");
    expect(salvadorLocalToIso("2026-12-31T22:30")).toBe("2027-01-01T04:30:00.000Z");
  });

  it("ida y vuelta sin desplazamientos", () => {
    const iso = salvadorLocalToIso("2026-11-15T19:45");
    expect(isoToSalvadorLocal(iso)).toBe("2026-11-15T19:45");
  });

  it.each(["2026-02-30T10:00", "2026-13-01T10:00", "2026-10-23T24:00", "23/10/2026", ""])(
    "rechaza la fecha imposible %s",
    (value) => {
      expect(salvadorLocalToIso(value)).toBeNull();
    },
  );

  it("exige que el cierre sea posterior al inicio", () => {
    const base = { name: "Reto 2026", prizeDescription: "", prizeTitle: "PC", slug: "reto-2026" };

    expect(campaignDetailsSchema.safeParse({ ...base, endsAt: "2026-10-23T08:00", startsAt: "2026-10-23T09:00" }).success).toBe(false);
    expect(campaignDetailsSchema.safeParse({ ...base, endsAt: "2026-12-18T18:00", startsAt: "2026-10-23T08:00" }).success).toBe(true);
    expect(campaignDetailsSchema.safeParse({ ...base, endsAt: "", startsAt: "" }).success).toBe(true);
  });

  it("valida el slug", () => {
    const base = { endsAt: "", name: "Reto 2026", prizeDescription: "", prizeTitle: "", startsAt: "" };

    expect(campaignDetailsSchema.safeParse({ ...base, slug: "Reto 2026!" }).success).toBe(false);
    expect(campaignDetailsSchema.safeParse({ ...base, slug: "RETO-2026" }).success).toBe(true);
  });
});
