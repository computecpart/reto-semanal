import { describe, expect, it } from "vitest";

import { formatPoints, isTie, pointAdjustmentSchema, rankingSettingsSchema } from "@/lib/points/config";

describe("puntos", () => {
  it("formatea importes con signo", () => {
    expect(formatPoints(25)).toBe("+25");
    expect(formatPoints(-10)).toBe("−10");
    expect(formatPoints(1500)).toMatch(/^\+1.?500$/);
  });

  it("detecta empates por posición compartida", () => {
    const rows = [{ standing: 1 }, { standing: 1 }, { standing: 3 }];

    expect(isTie(rows, 0)).toBe(true);
    expect(isTie(rows, 1)).toBe(true);
    expect(isTie(rows, 2)).toBe(false);
  });

  it("un ajuste exige motivo, participante e importe distinto de cero", () => {
    const base = { amount: "25", description: "", reason: "Misión presencial validada", userId: "11111111-2222-4333-8444-555555555555" };

    expect(pointAdjustmentSchema.safeParse(base).success).toBe(true);
    expect(pointAdjustmentSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(pointAdjustmentSchema.safeParse({ ...base, amount: "2.5" }).success).toBe(false);
    expect(pointAdjustmentSchema.safeParse({ ...base, reason: "corto" }).success).toBe(false);
    expect(pointAdjustmentSchema.safeParse({ ...base, userId: "x" }).success).toBe(false);
  });

  it("la configuración del ranking solo acepta valores cerrados", () => {
    expect(rankingSettingsSchema.safeParse({ audience: "public", highlightTop: "5", identity: "alias_passport", visible: true }).success).toBe(true);
    expect(rankingSettingsSchema.safeParse({ audience: "everyone", highlightTop: "5", identity: "alias", visible: true }).success).toBe(false);
    expect(rankingSettingsSchema.safeParse({ audience: "public", highlightTop: "50", identity: "alias", visible: true }).success).toBe(false);
  });
});
