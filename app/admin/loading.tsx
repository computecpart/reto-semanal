export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4" role="status">
      <span className="sr-only">Cargando…</span>
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" />
    </div>
  );
}
