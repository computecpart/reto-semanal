import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pixel-grid flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4 text-[var(--color-ink)]">
      <section className="pixel-frame max-w-md bg-white p-8 text-center">
        <p className="font-display text-6xl">404</p>
        <h1 className="mt-4 font-display text-2xl">Esta página no existe</h1>
        <p className="mt-2 text-slate-600">Puede que el enlace haya cambiado o ya no esté disponible.</p>
        <Link className="pixel-button mt-6 inline-flex bg-[var(--accent)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)]" href="/">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
