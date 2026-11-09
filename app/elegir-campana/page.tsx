import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { readableDigits } from "@/components/ui/readable-digits";
import { signOutAction } from "@/lib/auth/actions";
import { requireSessionPage } from "@/lib/auth/guards";
import { chooseCampaignAction, joinPrimaryCampaignAction } from "@/lib/campaign/actions";
import { campaignChoices, CHOOSER_PATH } from "@/lib/campaign/choices";
import { getCampaignBranding, getMyCampaigns } from "@/lib/campaign/queries";
import { DARK_SURFACE, themeStyle } from "@/lib/landing/theme";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { getMyProfile } from "@/lib/profile/my-profile";

export const metadata: Metadata = {
  title: "Elige tu campaña | Reto Semanal",
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-ink)]";

/**
 * Shown after signing in, only to people who joined a private campaign with its
 * link. Each card wears its own campaign's colors; the panels never mix.
 */
export default async function ChooseCampaignPage() {
  const { role, user } = await requireSessionPage(CHOOSER_PATH);
  const choices = campaignChoices(await getMyCampaigns());

  // Almost everyone has a single campaign: straight to its panel, nothing else loaded.
  if (!choices.mustChoose) {
    redirect(choices.options[0]?.href ?? "/app");
  }

  const [profile, ...brandings] = await Promise.all([
    getMyProfile(user.id).catch(() => null),
    ...choices.options.map((option) => getCampaignBranding(option.slug, option.name)),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)] text-[var(--color-ink)]">
      <main className="pixel-grid flex-1 px-4 py-8 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
            {profile?.alias ? `Hola, @${profile.alias}` : "Hola"}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">¿A qué campaña quieres entrar?</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Cada campaña tiene sus propias trivias, misiones, puntos y ranking. Puedes cambiar cuando quieras desde el
            menú de tu cuenta.
          </p>

          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {choices.options.map((option, index) => {
              const branding = brandings[index] ?? { name: option.name, theme: null };
              const dark = branding.theme?.surface === "oscuro";
              const band: CSSProperties = dark
                ? { background: DARK_SURFACE.page, color: "var(--accent-on-dark)" }
                : { background: "var(--accent)", color: "var(--accent-contrast)" };

              return (
                <li key={option.href}>
                  <form action={chooseCampaignAction} className="h-full">
                    <input name="destino" type="hidden" value={option.href} />
                    <button
                      className={`pixel-frame group flex h-full w-full cursor-pointer flex-col bg-white text-left ${focusRing}`}
                      style={branding.theme ? themeStyle(branding.theme) : undefined}
                      type="submit"
                    >
                      <span className="block w-full border-b-4 border-[var(--color-ink)] px-5 py-6" style={band}>
                        <span className="block text-[11px] font-bold uppercase tracking-[0.2em] opacity-85">
                          {option.slug ? "Por invitación" : "Campaña principal"}
                        </span>
                        <span className="mt-2 block font-display text-2xl leading-tight">
                          {readableDigits(branding.name)}
                        </span>
                      </span>
                      <span className="flex w-full flex-1 items-end px-5 py-5">
                        <span className="pixel-button inline-flex min-h-11 w-full items-center justify-center bg-[var(--accent)] px-4 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)]">
                          Entrar
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          {choices.joinableMain ? (
            <section className="mt-8 border-2 border-dashed border-slate-400 bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold">¿También quieres participar en {choices.joinableMain}?</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Es una campaña aparte, con su propio ranking: tus puntos de cada campaña no se mezclan.
              </p>
              <form action={joinPrimaryCampaignAction} className="mt-4">
                <button
                  className={`pixel-button inline-flex min-h-11 items-center justify-center bg-white px-4 text-sm font-bold uppercase tracking-wide ${focusRing}`}
                  type="submit"
                >
                  Unirme también
                </button>
              </form>
            </section>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            {isAdministrativeRole(role) ? (
              <Link className={`inline-flex min-h-10 items-center font-bold underline-offset-4 hover:underline ${focusRing}`} href="/admin">
                Consola de administración
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button
                className={`inline-flex min-h-10 items-center font-bold text-red-700 underline-offset-4 hover:underline ${focusRing}`}
                type="submit"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
