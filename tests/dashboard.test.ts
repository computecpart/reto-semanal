import { describe, expect, it } from "vitest";

import { campaignProgress, nextGoal, pointsBreakdown, pointsByWeek } from "@/lib/dashboard/stats";

const START = "2026-10-23T14:00:00Z";
const END = "2026-12-12T05:59:00Z";

describe("progreso de la campaña", () => {
  it("calcula las semanas y la fase", () => {
    expect(campaignProgress(new Date("2026-10-22T12:00:00Z"), START, END)).toMatchObject({ phase: "upcoming", week: 0, weeks: 8 });
    expect(campaignProgress(new Date("2026-10-24T12:00:00Z"), START, END)).toMatchObject({ phase: "active", week: 1 });
    expect(campaignProgress(new Date("2026-11-07T12:00:00Z"), START, END)).toMatchObject({ phase: "active", week: 3 });
    expect(campaignProgress(new Date("2026-12-20T12:00:00Z"), START, END)).toMatchObject({ daysLeft: 0, phase: "ended" });
    expect(campaignProgress(new Date(), null, END)).toBeNull();
  });
});

describe("puntos del jugador", () => {
  const events = [
    { amount: 20, created_at: "2026-10-24T15:00:00Z", kind: "quiz" },
    { amount: 5, created_at: "2026-10-24T15:00:01Z", kind: "quiz_speed_bonus" },
    { amount: 25, created_at: "2026-11-01T15:00:00Z", kind: "mission" },
    { amount: 15, created_at: "2026-11-02T15:00:00Z", kind: "open_review" },
    { amount: -5, created_at: "2026-11-03T15:00:00Z", kind: "correction" },
  ];

  it("agrupa por semana de campaña", () => {
    expect(pointsByWeek(events, START, 8)).toEqual([25, 35, 0, 0, 0, 0, 0, 0]);
  });

  it("separa el origen de los puntos", () => {
    expect(pointsBreakdown(events)).toEqual({ adjustments: -5, missions: 25, quizzes: 35, speed: 5 });
  });
});

describe("siguiente meta", () => {
  const rows = [
    { points: 90, standing: 1 },
    { points: 70, standing: 2 },
    { points: 70, standing: 2 },
    { points: 50, standing: 4 },
    { points: 40, standing: 5 },
    { points: 30, standing: 6 },
    { points: 0, standing: 7 },
  ];

  it("fuera del Top 5 indica cuánto falta para entrar", () => {
    expect(nextGoal(rows, { points: 30, standing: 6 })).toEqual({ kind: "top", missing: 11, top: 5 });
  });

  it("dentro del Top 5 indica cuánto falta para subir un puesto", () => {
    expect(nextGoal(rows, { points: 50, standing: 4 })).toEqual({ kind: "climb", missing: 21, target: 2 });
  });

  it("en primer lugar muestra la ventaja", () => {
    expect(nextGoal(rows, { points: 90, standing: 1 })).toEqual({ kind: "lead", margin: 20 });
  });

  it("sin puntos de nadie no hay meta", () => {
    expect(nextGoal([{ points: 0, standing: 1 }], { points: 0, standing: 1 })).toBeNull();
  });
});
