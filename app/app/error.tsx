"use client";

// Generic message only: error details never reach participants.
export default function ParticipantError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="pixel-frame bg-white p-8" role="alert">
      <h1 className="font-display text-2xl">Algo salió mal</h1>
      <p className="mt-2 text-slate-600">No pudimos cargar esta sección. Inténtalo de nuevo en unos segundos.</p>
      <button className="pixel-button mt-6 bg-[var(--accent)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)]" onClick={reset} type="button">
        Reintentar
      </button>
    </section>
  );
}
