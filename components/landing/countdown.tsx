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

export function Countdown({ endsAt, startsAt }: { endsAt: string | null; startsAt: string | null }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  const start = startsAt ? Date.parse(startsAt) / 1000 : null;
  const end = endsAt ? Date.parse(endsAt) / 1000 : null;

  if (now === null) {
    // Same footprint as the final markup to avoid a layout jump on hydration.
    return <div aria-hidden="true" className="h-[5.5rem]" />;
  }

  const upcoming = start !== null && now < start;
  const target = upcoming ? start : end !== null && now < end ? end : null;

  if (target === null) {
    return null;
  }

  const remaining = Math.max(0, Math.floor(target - now));
  const values = UNITS.map((unit, index) => {
    const larger = UNITS[index - 1];
    const span = larger ? remaining % larger.seconds : remaining;
    return { ...unit, value: Math.floor(span / unit.seconds) };
  });

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.25em] opacity-80">
        {upcoming ? "La aventura empieza en" : "La campaña termina en"}
      </p>
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
