import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { getSiteBranding } from "@/lib/campaign/queries";
import { landingAssetUrl } from "@/lib/landing/assets";
import { DARK_SURFACE, themeStyle } from "@/lib/landing/theme";
import { createClient } from "@/lib/supabase/server";

import { MobileMenu } from "./mobile-menu";

export interface SiteNavLink {
  href: string;
  label: string;
}

// Anchors of the public landing; pages other than "/" link to them absolutely.
export const PUBLIC_NAV: readonly SiteNavLink[] = [
  { href: "/#como-participar", label: "Cómo participar" },
  { href: "/#premio", label: "Premio" },
  { href: "/#ranking", label: "Ranking" },
  { href: "/#preguntas", label: "Preguntas" },
  { href: "/reglas", label: "Reglas" },
];

export function siteSurfaceStyle(dark: boolean): CSSProperties {
  const vars: Record<string, string> =
    dark
      ? {
          // On dark surfaces the darker "strong" shade lacks contrast; use the light tint.
          "--accent-strong": "var(--accent-on-dark)",
          "--frame": DARK_SURFACE.frame,
          "--site-header-bg": DARK_SURFACE.page,
        }
      : { "--frame": "var(--color-ink)", "--site-header-bg": "var(--color-paper)" };

  return vars as CSSProperties;
}

const navLink =
  "inline-flex min-h-10 items-center whitespace-nowrap px-2 text-sm font-semibold opacity-85 transition hover:text-[var(--accent-strong)] hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";
const ctaLink =
  "inline-flex min-h-10 items-center border-2 border-[var(--frame)] bg-[var(--accent)] px-3 text-sm font-bold text-[var(--accent-contrast)] shadow-[2px_2px_0_0_var(--frame)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

/** Shared public navigation: landing, sign-in pages, rules and legal pages. */
export function SiteHeaderView({
  campaignName,
  dark,
  links,
  logo,
  signedIn,
  themeVars,
}: {
  campaignName: string;
  dark: boolean;
  links: readonly SiteNavLink[];
  logo: { alt: string; url: string } | null;
  signedIn: boolean;
  themeVars?: CSSProperties;
}) {
  return (
    <header
      className={`sticky top-0 z-40 border-b-2 border-[var(--frame)] bg-[var(--site-header-bg)] ${dark ? "text-white" : "text-[var(--color-ink)]"}`}
      style={{ ...themeVars, ...siteSurfaceStyle(dark) }}
    >
      <div aria-hidden="true" className="h-1 bg-[var(--accent)]" />
      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link className="flex min-h-10 min-w-0 items-center gap-3 font-display text-base leading-tight sm:text-lg" href="/">
          {logo ? <Image alt={logo.alt} className="h-9 w-auto shrink-0" height={36} src={logo.url} unoptimized width={120} /> : null}
          <span className="line-clamp-2">{campaignName}</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 xl:flex">
          {links.map((link) => (
            <Link className={navLink} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            {signedIn ? (
              <Link className={ctaLink} href="/app/perfil">
                Mi pasaporte
              </Link>
            ) : (
              <>
                <Link className={navLink} href="/login">
                  Entrar
                </Link>
                <Link className={ctaLink} href="/registro">
                  Crear pasaporte
                </Link>
              </>
            )}
          </div>
          <MobileMenu links={links} signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}

export async function getSignedIn(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims.sub);
}

/** Header for pages outside the landing: loads branding and session itself. */
export async function SiteHeader() {
  const [branding, signedIn] = await Promise.all([getSiteBranding(), getSignedIn()]);
  const logoUrl = landingAssetUrl(branding.theme.logo?.path);

  return (
    <SiteHeaderView
        campaignName={branding.name}
        dark={branding.theme.surface === "oscuro"}
        links={PUBLIC_NAV}
        logo={logoUrl ? { alt: branding.theme.logo?.alt || branding.name, url: logoUrl } : null}
        signedIn={signedIn}
        themeVars={themeStyle(branding.theme)}
      />
  );
}
