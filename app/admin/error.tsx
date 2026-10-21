"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm" role="alert">
      <h1 className="text-xl font-bold">No se pudo cargar esta sección</h1>
      <p className="mt-2 text-sm text-slate-600">
        Revisa tu sesión e inténtalo de nuevo. Si persiste, comparte este código con soporte: {error.digest ?? "sin código"}.
      </p>
      <button className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
        Reintentar
      </button>
    </section>
  );
}
