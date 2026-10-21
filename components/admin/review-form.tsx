"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { reviewAnswerAction } from "@/lib/quiz/actions";

const button = "rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

export function ReviewForm({
  attemptId,
  currentNote,
  currentPoints,
  maxPoints,
  questionId,
}: {
  attemptId: string;
  currentNote: string | null;
  currentPoints: number | null;
  maxPoints: number;
  questionId: string;
}) {
  const router = useRouter();
  const [points, setPoints] = useState(currentPoints ?? maxPoints);
  const [note, setNote] = useState(currentNote ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function decide(value: number) {
    startTransition(async () => {
      const result = await reviewAnswerAction(attemptId, questionId, value, note);
      setMessage({ ok: result.status === "success", text: result.message });

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className={`${button} bg-emerald-700 text-white`} disabled={pending} onClick={() => decide(maxPoints)} type="button">
          Aprobar ({maxPoints})
        </button>
        <button className={`${button} bg-red-700 text-white`} disabled={pending} onClick={() => decide(0)} type="button">
          Rechazar (0)
        </button>
        <span className="flex items-center gap-1 text-xs">
          Parcial:
          <input
            aria-label="Puntos parciales"
            className="w-20 rounded-md border border-slate-300 px-2 py-1"
            max={maxPoints}
            min={0}
            onChange={(event) => setPoints(Number(event.target.value))}
            type="number"
            value={points}
          />
          <button className={`${button} border border-slate-300`} disabled={pending} onClick={() => decide(points)} type="button">
            Guardar
          </button>
        </span>
      </div>
      <input
        aria-label="Nota interna"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Nota interna (opcional)"
        value={note}
      />
      {message ? <p className={`text-xs ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p> : null}
    </div>
  );
}
