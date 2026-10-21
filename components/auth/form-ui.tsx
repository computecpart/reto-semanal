import type { ButtonHTMLAttributes, ReactNode } from "react";

// Participant-facing form kit: same pixel language as the public landing.
// Colors come from the campaign theme variables (--accent*) set by the shell.
export const fieldClassName =
  "mt-2 w-full border-2 border-[var(--color-ink)] bg-white px-3.5 py-3 text-base text-[var(--color-ink)] outline-none transition placeholder:text-slate-400 focus:shadow-[4px_4px_0_0_var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:bg-slate-100 aria-[invalid=true]:border-red-700";

export const labelClassName = "block text-sm font-bold text-[var(--color-ink)]";

export const linkClassName =
  "font-bold text-[var(--accent-strong)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

export const checkboxClassName = "mt-1 size-4 shrink-0 accent-[var(--accent)]";

export function FieldError({ children, id }: { children?: string; id: string }) {
  if (!children) {
    return null;
  }

  return (
    <p className="mt-1.5 text-sm font-semibold text-red-700" id={id}>
      {children}
    </p>
  );
}

export function FormStatus({
  children,
  tone = "error",
}: {
  children?: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  if (!children) {
    return null;
  }

  const toneClassName = {
    error: "bg-red-50 text-red-900 [--frame:#b91c1c]",
    info: "bg-[var(--accent-soft)] text-[var(--color-ink)]",
    success: "bg-emerald-50 text-emerald-950 [--frame:#047857]",
  }[tone];

  return (
    <div
      aria-live="polite"
      className={`pixel-frame-sm px-4 py-3 text-sm font-medium leading-6 ${toneClassName}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
}

export function SubmitButton({
  children,
  className = "",
  disabled,
  pending = false,
  pendingLabel = "Procesando…",
  ...props
}: SubmitButtonProps) {
  return (
    <button
      className={`pixel-button inline-flex min-h-12 w-full items-center justify-center bg-[var(--accent)] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export const secondaryButtonClassName =
  "pixel-button inline-flex min-h-12 items-center justify-center bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";

/** Pixel card used by participant screens. */
export function PixelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`pixel-frame bg-white p-5 sm:p-8 ${className}`}>{children}</section>;
}

export function SectionTitle({
  children,
  description,
  id,
}: {
  children: ReactNode;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <header className="mb-6">
      <h2 className="font-display text-2xl leading-tight" id={id}>
        {children}
      </h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </header>
  );
}
