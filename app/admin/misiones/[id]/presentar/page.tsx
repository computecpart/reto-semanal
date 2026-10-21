import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { requireAdminPage } from "@/lib/auth/guards";
import { qrPngDataUrl } from "@/lib/missions/qr";
import { getAdminMission, getSiteOrigin } from "@/lib/missions/queries";
import { formatCode, redeemUrl } from "@/lib/missions/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Presentar misión",
};

const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "long", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE });

// Full-screen overlay above the admin chrome, meant for a projector or a live.
export default async function PresentMissionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const mission = await getAdminMission(id);

  if (!mission?.code) {
    notFound();
  }

  const png = await qrPngDataUrl(redeemUrl(await getSiteOrigin(), mission.code), 1024);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-auto bg-[#0b1020] p-6 text-center text-white">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/70">Misión especial</p>
      <h1 className="max-w-4xl text-4xl font-bold sm:text-6xl">{mission.name}</h1>
      <div className="rounded-2xl bg-white p-4">
        <Image alt="" className="size-[min(60vh,80vw)]" height={1024} src={png} unoptimized width={1024} />
      </div>
      <p className="font-mono text-5xl font-bold tracking-[0.25em] sm:text-7xl">{formatCode(mission.code)}</p>
      <p className="text-2xl font-bold">+{mission.points} puntos</p>
      <p className="text-sm text-white/70">
        Canjea en piensads.app → Canjear · Vigente hasta {dateFormat.format(new Date(mission.expires_at))} (hora de El Salvador)
      </p>
    </div>
  );
}
