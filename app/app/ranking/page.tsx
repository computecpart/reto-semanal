import type { Metadata } from "next";

import { FormStatus, PixelCard } from "@/components/auth/form-ui";
import { RankingTable } from "@/components/points/ranking-table";
import { requireSessionPage } from "@/lib/auth/guards";
import { getRanking, getRankingSettings } from "@/lib/points/queries";

export const metadata: Metadata = {
  title: "Ranking",
};

export default async function RankingPage() {
  await requireSessionPage("/app/ranking");
  const [rows, settings] = await Promise.all([getRanking(), getRankingSettings()]);
  const highlightTop = settings?.highlight_top ?? 5;
  const me = rows.find((row) => row.is_current_user);

  return (
    <div className="space-y-8">
      <header>
        <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
          Tabla de posiciones
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight">Ranking</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Ordenado por puntos; los empates se ordenan por respuestas correctas y luego por eventos completados.
          {highlightTop > 0 ? ` Los ${highlightTop} primeros forman el Top ${highlightTop}.` : ""}
        </p>
      </header>

      {settings?.provisional ? (
        <FormStatus tone="info">Clasificación provisional: hay respuestas pendientes de revisión.</FormStatus>
      ) : null}

      {rows.length === 0 ? (
        <PixelCard>
          <p className="text-center text-slate-600">
            El ranking aún no está visible. Se publicará cuando el equipo organizador lo active.
          </p>
        </PixelCard>
      ) : (
        <>
          {me && me.standing > highlightTop ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tu posición</p>
              <RankingTable highlightTop={highlightTop} rows={[me]} />
            </div>
          ) : null}
          <RankingTable highlightTop={highlightTop} rows={rows} />
        </>
      )}
    </div>
  );
}
