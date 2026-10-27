"use client";

import { passwordChecklist } from "@/lib/auth/password-strength";

/** Live checklist under a new-password field; updates while typing. */
export function PasswordGuidance({ id, password }: { id: string; password: string }) {
  return (
    <div className="mt-2 border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-xs leading-5" id={id}>
      <ul className="space-y-1">
        {passwordChecklist(password).map((item) => (
          <li className={`flex items-center gap-2 ${item.ok ? "text-emerald-800" : "text-slate-600"}`} key={item.label}>
            <span
              aria-hidden="true"
              className={`grid size-4 shrink-0 place-items-center border-2 text-[10px] font-bold leading-none ${item.ok ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-400 bg-white"}`}
            >
              {item.ok ? "✓" : ""}
            </span>
            <span>
              {item.label}
              <span className="sr-only">{item.ok ? " (cumplido)" : " (pendiente)"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-slate-600">
        <strong className="text-[var(--color-ink)]">Idea:</strong> une tres palabras que no tengan relación y añade un
        número o símbolo. Evita 12345678, tu nombre o claves que ya uses en otros sitios: se rechazan si aparecen en
        filtraciones públicas.
      </p>
    </div>
  );
}
