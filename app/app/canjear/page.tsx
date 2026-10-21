import type { Metadata } from "next";

import { PixelCard } from "@/components/auth/form-ui";
import { RedeemPanel } from "@/components/missions/redeem-panel";
import { requireSessionPage } from "@/lib/auth/guards";
import { getSiteOrigin } from "@/lib/missions/queries";
import { formatCode, isValidCode } from "@/lib/missions/schema";

export const metadata: Metadata = {
  title: "Canjear misión",
};

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const params = await searchParams;
  const raw = typeof params.c === "string" ? params.c : "";
  const code = isValidCode(raw) ? formatCode(raw) : null;
  await requireSessionPage(code ? `/app/canjear?c=${code}` : "/app/canjear");
  const origin = await getSiteOrigin();

  return (
    <div className="space-y-8">
      <header>
        <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
          Misiones
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight">Canjear misión</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Escribe el código que te da el equipo de Digit@l Solutions o escanea su QR. Cada misión se canjea una sola vez,
          sin importar si usas el código o el QR.
        </p>
      </header>
      <PixelCard>
        <RedeemPanel initialCode={code} origin={origin} />
      </PixelCard>
    </div>
  );
}
