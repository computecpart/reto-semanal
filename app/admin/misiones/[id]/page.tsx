import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MissionForm, RegenerateCodeForm } from "@/components/admin/mission-forms";
import { requireAdminPage } from "@/lib/auth/guards";
import { getSiteBranding } from "@/lib/campaign/queries";
import { qrPngDataUrl, qrSvgDataUrl, qrSvgWithLogoDataUrl } from "@/lib/missions/qr";
import { getAdminMission, getSiteOrigin } from "@/lib/missions/queries";
import { formatCode, redeemUrl } from "@/lib/missions/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Misión | Administración",
};

const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";
const button = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50";
const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "short", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE });

export default async function AdminMissionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const mission = await getAdminMission(id);

  if (!mission) {
    notFound();
  }

  const url = mission.code ? redeemUrl(await getSiteOrigin(), mission.code) : null;
  const branding = await getSiteBranding();
  const [png, svg, svgLogo] = url
    ? await Promise.all([qrPngDataUrl(url), qrSvgDataUrl(url), qrSvgWithLogoDataUrl(url, branding.theme.logo?.path)])
    : [null, null, null];
  const fileName = `mision-${mission.code ? formatCode(mission.code) : mission.id}`;

  return (
    <div className="space-y-6">
      <Link className="text-sm font-semibold text-sky-800 hover:underline" href="/admin/misiones">
        ← Misiones
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{mission.name}</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className={card}>
          <h2 className="mb-4 text-lg font-bold">Datos</h2>
          <MissionForm mission={mission} />
        </section>

        <section className={`${card} space-y-4`}>
          <h2 className="text-lg font-bold">Código y QR</h2>
          {mission.code && png && svg ? (
            <>
              <p className="text-center font-mono text-3xl font-bold tracking-[0.2em]">{formatCode(mission.code)}</p>
              <Image alt={`QR de la misión ${mission.name}`} className="mx-auto" height={240} src={png} unoptimized width={240} />
              <p className="break-all text-center text-xs text-slate-500">{url}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <a className={button} download={`${fileName}.png`} href={png}>
                  PNG
                </a>
                <a className={button} download={`${fileName}.svg`} href={svg}>
                  SVG
                </a>
                {svgLogo ? (
                  <a className={button} download={`${fileName}-logo.svg`} href={svgLogo}>
                    SVG con logo
                  </a>
                ) : null}
                <Link className={button} href={`/admin/misiones/${mission.id}/presentar`} target="_blank">
                  Presentar
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Sin código.</p>
          )}
          <RegenerateCodeForm missionId={mission.id} />
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Canjes ({mission.redemptions.length})</h2>
          <a className={button} href={`/admin/misiones/${mission.id}/canjes`}>
            Exportar CSV
          </a>
        </div>
        {mission.redemptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nadie ha canjeado esta misión todavía.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {mission.redemptions.map((redemption) => (
              <li className="flex flex-wrap justify-between gap-2 py-2" key={redemption.passport_code}>
                <span>
                  <span className="font-semibold">@{redemption.alias}</span> · {redemption.full_name} ·{" "}
                  <span className="font-mono text-xs">{redemption.passport_code}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {redemption.channel === "qr" ? "QR" : "Código"} · {dateFormat.format(new Date(redemption.redeemed_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
