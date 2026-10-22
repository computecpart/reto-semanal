// Pixel-art charts built from square blocks; colors come from the campaign theme.

const numberFormat = new Intl.NumberFormat("es-SV");

/** Vertical bars made of stacked blocks (max 10 per bar). */
export function PixelBarChart({
  current,
  labels,
  summary,
  values,
}: {
  /** Index of the highlighted bar (current week), or -1. */
  current: number;
  labels: readonly string[];
  summary: string;
  values: readonly number[];
}) {
  const max = Math.max(1, ...values);
  const BLOCKS = 10;

  return (
    <figure>
      <div aria-hidden="true" className="flex h-56 items-end gap-1.5 sm:gap-3">
        {values.map((value, index) => {
          const filled = value > 0 ? Math.max(1, Math.round((value / max) * BLOCKS)) : 0;
          const future = current >= 0 && index > current;
          const highlight = index === current;

          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1" key={labels[index] ?? index}>
              <span className="font-score text-xs leading-none">{value !== 0 ? numberFormat.format(value) : ""}</span>
              <div className="flex w-full flex-col-reverse gap-0.5">
                {Array.from({ length: BLOCKS }, (_, block) => (
                  <span
                    className={`block h-3.5 w-full ${
                      block < filled
                        ? highlight
                          ? "bg-[var(--accent)]"
                          : "bg-[var(--color-ink)]"
                        : future
                          ? "bg-transparent"
                          : "bg-slate-200/70"
                    }`}
                    key={block}
                  />
                ))}
              </div>
              <span
                className={`mt-1 w-full border-t-2 pt-1 text-center text-[11px] font-bold uppercase ${
                  highlight ? "border-[var(--accent)] text-[var(--accent-strong)]" : "border-[var(--color-ink)] text-slate-500"
                }`}
              >
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

/** Horizontal meter of 20 segments with label and value. */
export function PixelMeter({ color, label, max, value }: { color: string; label: string; max: number; value: number }) {
  const SEGMENTS = 20;
  const filled = value > 0 ? Math.max(1, Math.round((value / Math.max(1, max)) * SEGMENTS)) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-score">{numberFormat.format(value)} pts</span>
      </div>
      <div aria-hidden="true" className="mt-1.5 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span className="h-3" key={index} style={{ background: index < filled ? color : "rgb(226 232 240 / 0.7)" }} />
        ))}
      </div>
    </div>
  );
}

/** Row of segments, e.g. weeks of the campaign; `done` are filled. */
export function SegmentProgress({ done, label, total }: { done: number; label: string; total: number }) {
  return (
    <div
      aria-label={label}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={done}
      className="flex gap-1"
      role="progressbar"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          className={`h-4 flex-1 border-2 border-[var(--color-ink)] ${
            index < done - 1 ? "bg-[var(--color-ink)]" : index === done - 1 ? "bg-[var(--accent)]" : "bg-white"
          }`}
          key={index}
        />
      ))}
    </div>
  );
}
