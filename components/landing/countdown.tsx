"use client";

import { useSyncExternalStore } from "react";

// Presentation only: start and end instants come from the server, and the
// database alone decides whether an activity is open.
function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 1000);
  return () => window.clearInterval(timer);
}

const getNow = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null;

const UNITS = [
  { label: "días", seconds: 86_400 },
  { label: "horas", seconds: 3_600 },
  { label: "min", seconds: 60 },
  { label: "seg", seconds: 1 },
] as const;

const toSeconds = (value: string | null) => (value ? Date.parse(value) / 1000 : null);

/**
 * Counts down to `customAt` when the admin set one; otherwise to the campaign
 * start and, once started, to its end. Disappears when the target passes.
 */
export function Countdown({
  customAt,
  endsAt,
  label,
  startsAt,
}: {
  customAt: string | null;
  endsAt: string | null;
  label: string;
  startsAt: string | null;
}) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);

  if (now === null) {
    // Same footprint as the final markup to avoid a layout jump on hydration.
    return <div aria-hidden="true" className="h-[5.5rem]" />;
  }

  const custom = toSeconds(customAt);
  const start = toSeconds(startsAt);
  const end = toSeconds(endsAt);
  let target: number | null = null;
  let fallbackLabel = "Faltan";

  if (custom !== null) {
    target = now < custom ? custom : null;
  } else if (start !== null && now < start) {
    target = start;
    fallbackLabel = "La aventura empieza en";
  } else if (end !== null && now < end) {
    target = end;
    fallbackLabel = "La campaña termina en";
  }

  if (target === null) {
    return null;
  }

  const remaining = Math.max(0, Math.floor(target - now));
  const values = UNITS.map((unit, index) => {
    const larger = UNITS[index - 1];
    const span = larger ? remaining % larger.seconds : remaining;
    return { ...unit, value: Math.floor(span / unit.seconds) };
  }).filter((unit) => unit.label !== "días" || unit.value > 0);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">{label || fallbackLabel}</p>
      <ol className="mt-2 flex gap-2" role="timer">
        {values.map((unit) => (
          <li
            className="pixel-frame-sm grid min-w-16 place-items-center bg-[var(--landing-card)] px-2 py-1.5 text-center"
            key={unit.label}
          >
            <span className="font-score text-2xl leading-none tabular-nums sm:text-3xl">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-70">{unit.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
