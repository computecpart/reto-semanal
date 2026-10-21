import type { ReactNode } from "react";

interface FoundationStatusProps {
  children: ReactNode;
}

export function FoundationStatus({ children }: FoundationStatusProps) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/75 p-5 shadow-sm backdrop-blur">
      <span
        aria-hidden="true"
        className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700"
      >
        ✓
      </span>
      <p className="leading-7 text-slate-700">{children}</p>
    </article>
  );
}

