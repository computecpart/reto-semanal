import type { ButtonHTMLAttributes, ReactNode } from "react";

export const fieldClassName =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100";

export const labelClassName = "block text-sm font-semibold text-slate-800";

export function FieldError({ children, id }: { children?: string; id: string }) {
  if (!children) {
    return null;
  }

  return (
    <p className="mt-1.5 text-sm text-red-700" id={id}>
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
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tone];

  return (
    <div
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${toneClassName}`}
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
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400 ${className}`}
      disabled={disabled || pending}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

