import Image from "next/image";

import { getAvatar } from "@/lib/avatars";
import { isTie } from "@/lib/points/config";
import type { RankingRow } from "@/lib/points/queries";

const numberFormat = new Intl.NumberFormat("es-SV");

function identity(row: RankingRow): { primary: string; secondary: string | null } {
  const primary = row.alias ? `@${row.alias}` : (row.display_name ?? "Participante");
  const secondary = row.alias ? (row.passport_hint ?? row.display_name) : null;
  return { primary, secondary };
}

export function RankingTable({
  dark = false,
  highlightTop = 5,
  rows,
}: {
  dark?: boolean;
  highlightTop?: number;
  rows: readonly RankingRow[];
}) {
  return (
    <ol aria-label="Clasificación" className="space-y-3">
      {rows.map((row, index) => {
        const avatar = getAvatar(row.avatar_id);
        const { primary, secondary } = identity(row);
        const top = row.standing <= highlightTop && row.points > 0;
        const tie = isTie(rows, index);
        const surface = row.is_current_user
          ? "bg-[var(--accent-soft)] text-[var(--color-ink)]"
          : dark
            ? "bg-[#141b33]"
            : "bg-white";

        return (
          <li
            aria-current={row.is_current_user ? "true" : undefined}
            className={`pixel-frame-sm flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${surface}`}
            key={`${row.standing}-${primary}-${index}`}
          >
            <span
              className={`grid size-11 shrink-0 place-items-center font-score text-lg ${top ? "bg-[var(--accent)] text-[var(--accent-contrast)]" : "border-2 border-current"}`}
              title={tie ? "Empate" : undefined}
            >
              {row.standing}
            </span>
            {avatar ? (
              <Image alt="" className="pixelated size-11 shrink-0" height={44} src={avatar.src} unoptimized width={44} />
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">
                {primary}
                {row.is_current_user ? <span className="ml-2 text-xs font-bold uppercase tracking-wide">(tú)</span> : null}
              </span>
              <span className="block truncate text-xs opacity-75">
                {secondary}
                {tie ? `${secondary ? " · " : ""}Empate` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-score text-xl leading-none">{numberFormat.format(row.points)}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">pts</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
