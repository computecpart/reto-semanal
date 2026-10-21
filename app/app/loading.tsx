export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4" role="status">
      <span className="sr-only">Cargando…</span>
      <div className="pixel-frame h-40 animate-pulse bg-white motion-reduce:animate-none" />
      <div className="pixel-frame h-64 animate-pulse bg-white motion-reduce:animate-none" />
    </div>
  );
}
