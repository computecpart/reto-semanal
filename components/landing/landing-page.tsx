import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { LegalLinks } from "@/components/legal/legal-page";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { RankingTable } from "@/components/points/ranking-table";
import { SiteHeaderView, type SiteNavLink } from "@/components/site/site-header";
import { readableDigits } from "@/components/ui/readable-digits";
import { getAvatar } from "@/lib/avatars";
import type { PublicCampaign } from "@/lib/campaign/queries";
import type { RankingRow } from "@/lib/points/queries";
import type { PublicQuiz } from "@/lib/quiz/queries";
import { landingAssetUrl } from "@/lib/landing/assets";
import type { CtaTarget, LandingContent, LandingSection, SectionOf } from "@/lib/landing/schema";
import { DARK_SURFACE, themeStyle } from "@/lib/landing/theme";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

import { Countdown } from "./countdown";

interface RenderContext {
  campaign: PublicCampaign;
  dark: boolean;
  primaryLabel: string;
  quizzes: readonly PublicQuiz[];
  ranking: readonly RankingRow[];
  signedIn: boolean;
}

const numberFormat = new Intl.NumberFormat("es-SV");

const SECTION_ANCHORS: Partial<Record<LandingSection["type"], { anchor: string; label: string }>> = {
  dates: { anchor: "fechas", label: "Fechas" },
  faq: { anchor: "preguntas", label: "Preguntas" },
  prize: { anchor: "premio", label: "Premio" },
  ranking_preview: { anchor: "ranking", label: "Ranking" },
  steps: { anchor: "como-participar", label: "Cómo participar" },
};

function ctaHref(target: CtaTarget, signedIn: boolean): string {
  if (target === "reglas") {
    return "/reglas";
  }

  return signedIn ? "/app" : target === "login" ? "/login" : "/registro";
}

function formatInstant(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: OPERATIONAL_TIME_ZONE,
  }).format(new Date(value));
}

// Pages are rendered per request (force-dynamic), so "now" is the request time.
function isFuture(value: string | null): boolean {
  return value ? Date.parse(value) > Date.now() : false;
}

function dateParts(value: string) {
  const date = new Date(value);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-SV", { ...options, timeZone: OPERATIONAL_TIME_ZONE }).format(date);

  return {
    day: part({ day: "numeric" }),
    month: part({ month: "short" }).replace(".", ""),
    time: part({ hour: "numeric", minute: "2-digit" }),
    weekday: part({ weekday: "long" }),
  };
}

const focusRing = "focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";

function PrimaryLink({ children, className = "", href }: { children: ReactNode; className?: string; href: string }) {
  return (
    <Link
      className={`pixel-button inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--accent)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)] ${focusRing} ${className}`}
      href={href}
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function SecondaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className={`pixel-button inline-flex min-h-12 items-center justify-center bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)] ${focusRing}`}
      href={href}
    >
      {children}
    </Link>
  );
}

/** Slanted accent bars: a nod to the dragon-red "gaming" look. */
function SlashBars({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex gap-1 ${className}`}>
      <span className="h-full w-1.5 -skew-x-[20deg] bg-[var(--accent)]" />
      <span className="h-full w-1.5 -skew-x-[20deg] bg-[var(--accent)] opacity-60" />
      <span className="h-full w-1.5 -skew-x-[20deg] bg-[var(--accent)] opacity-30" />
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent-strong)]">
      <SlashBars className="h-4" />
      {children}
    </p>
  );
}

function SectionShell({
  children,
  eyebrow,
  heading,
  id,
}: {
  children: ReactNode;
  eyebrow?: string;
  heading?: string;
  id: string;
}) {
  return (
    <section aria-labelledby={heading ? `${id}-heading` : undefined} className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {heading ? (
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight sm:text-4xl" id={`${id}-heading`}>
            {readableDigits(heading)}
          </h2>
        ) : null}
        <div className={heading ? "mt-8" : undefined}>{children}</div>
      </div>
    </section>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pixel-frame bg-[var(--landing-card)] p-5 sm:p-6 ${className}`}>{children}</div>;
}

function HeroSection({ context, section }: { context: RenderContext; section: SectionOf<"hero"> }) {
  const imageUrl = landingAssetUrl(section.image?.path);
  const { ends_at: endsAt, starts_at: startsAt } = context.campaign;
  const copy = (
    <>
      {section.eyebrow ? (
        <p className="inline-flex -skew-x-[12deg] bg-[var(--accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)] shadow-[4px_4px_0_0_var(--frame)]">
          <span className="skew-x-[12deg]">{section.eyebrow}</span>
        </p>
      ) : null}
      <h1 className="mt-6 font-display text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl">
        {readableDigits(section.headline)}
      </h1>
      {section.subtitle ? (
        <p className="mt-5 max-w-xl text-lg leading-8 opacity-85 sm:text-xl">{section.subtitle}</p>
      ) : null}
      {section.highlights.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {section.highlights.map((highlight) => (
            <li
              className="inline-flex items-center gap-2 border-2 border-[var(--frame)] px-3 py-1.5 text-sm font-semibold"
              key={highlight}
            >
              <span aria-hidden="true" className="size-2 bg-[var(--accent)]" />
              {highlight}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <PrimaryLink href={ctaHref("registro", context.signedIn)}>
          {context.signedIn ? "Ir a mi pasaporte" : section.primaryCtaLabel}
        </PrimaryLink>
        {section.secondaryCtaLabel && !context.signedIn ? (
          <SecondaryLink href="/login">{section.secondaryCtaLabel}</SecondaryLink>
        ) : null}
      </div>
      {section.showCountdown ? (
        <div className="mt-8">
          <Countdown customAt={section.countdownAt} endsAt={endsAt} label={section.countdownLabel} startsAt={startsAt} />
        </div>
      ) : null}
    </>
  );

  if (section.layout === "background" && imageUrl) {
    return (
      <section className="relative isolate overflow-hidden px-4 py-20 text-white sm:px-6 sm:py-32 [--landing-card:rgb(7_8_12/0.75)]">
        <Image alt={section.image?.alt ?? ""} className="-z-20 object-cover" fill priority sizes="100vw" src={imageUrl} unoptimized />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07080c] via-[#07080c]/80 to-[#07080c]/30" />
        <div className="mx-auto w-full max-w-5xl">
          <div className="max-w-2xl">{copy}</div>
        </div>
      </section>
    );
  }

  if (section.layout === "centered") {
    return (
      <section className="hero-glow relative isolate overflow-hidden px-4 py-16 text-center sm:px-6 sm:py-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center [&_ol]:justify-center [&_p]:mx-auto [&_ul]:justify-center">{copy}</div>
        {imageUrl ? (
          <div className="pixel-frame relative mx-auto mt-12 aspect-[16/9] w-full max-w-4xl overflow-hidden">
            <Image alt={section.image?.alt ?? ""} className="object-cover" fill priority sizes="(min-width: 1024px) 896px, 100vw" src={imageUrl} unoptimized />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="hero-glow relative isolate overflow-hidden px-4 py-12 sm:px-6 sm:py-24">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>{copy}</div>
        {imageUrl ? (
          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-4 -z-10 bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_45%,transparent),transparent_70%)] blur-2xl" />
            <div className="pixel-frame relative aspect-square w-full overflow-hidden bg-[var(--landing-card)]">
              <Image alt={section.image?.alt ?? ""} className="object-cover" fill priority sizes="(min-width: 1024px) 420px, 100vw" src={imageUrl} unoptimized />
            </div>
            <SlashBars className="absolute -bottom-3 -left-3 h-10" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PrizeSection({ context, section }: { context: RenderContext; section: SectionOf<"prize"> }) {
  const imageUrl = landingAssetUrl(section.image?.path);
  const { prize_description: description, prize_title: title } = context.campaign;

  if (!title && !section.note && !imageUrl) {
    return null;
  }

  return (
    <SectionShell eyebrow="Premio final" heading={section.heading} id={section.id}>
      <div className={`grid items-stretch gap-8 ${imageUrl ? "md:grid-cols-2" : ""}`}>
        {imageUrl ? (
          <div className="pixel-frame relative aspect-[4/3] overflow-hidden bg-[var(--landing-card)]">
            <Image alt={section.image?.alt ?? ""} className="object-cover" fill sizes="(min-width: 768px) 480px, 100vw" src={imageUrl} unoptimized />
          </div>
        ) : null}
        <div className="pixel-frame relative overflow-hidden bg-[var(--landing-card)] p-6 sm:p-8 [--frame:var(--accent)]">
          <div aria-hidden="true" className="absolute -right-10 -top-10 size-40 rounded-full bg-[var(--accent)] opacity-20 blur-3xl" />
          {title ? (
            <p className="relative font-display text-3xl leading-tight text-[var(--accent-strong)] sm:text-4xl">{readableDigits(title)}</p>
          ) : null}
          {description ? <p className="relative mt-4 whitespace-pre-line leading-7 opacity-90">{description}</p> : null}
          {section.note ? (
            <p className="relative mt-5 border-l-4 border-[var(--accent)] pl-4 text-sm leading-6 opacity-80">{section.note}</p>
          ) : null}
          {!context.signedIn ? (
            <PrimaryLink className="relative mt-6 w-full sm:w-auto" href="/registro">
              {context.primaryLabel}
            </PrimaryLink>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

function StepsSection({ section }: { section: SectionOf<"steps"> }) {
  return (
    <SectionShell eyebrow="Así se juega" heading={section.heading} id={section.id}>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {section.steps.map((step, index) => (
          <li key={`${section.id}-${index}`}>
            <Card className="h-full">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-grid size-11 shrink-0 -skew-x-[8deg] place-items-center bg-[var(--accent)] font-score text-xl text-[var(--accent-contrast)] shadow-[3px_3px_0_0_var(--frame)]"
                >
                  {index + 1}
                </span>
                <span aria-hidden="true" className="h-0.5 flex-1 bg-[repeating-linear-gradient(90deg,var(--frame)_0_6px,transparent_6px_12px)] opacity-40" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              {step.body ? <p className="mt-2 leading-7 opacity-85">{step.body}</p> : null}
            </Card>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  const parts = dateParts(value);

  return (
    <Card className="flex items-center gap-5">
      <div className="grid w-20 shrink-0 place-items-center bg-[var(--accent)] py-2 text-[var(--accent-contrast)]">
        <span className="font-score text-3xl leading-none">{parts.day}</span>
        <span className="mt-1 text-xs font-bold uppercase tracking-widest">{parts.month}</span>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">{label}</dt>
        <dd className="mt-1 text-lg font-semibold first-letter:uppercase">
          {parts.weekday}, {parts.time}
        </dd>
      </div>
    </Card>
  );
}

function DatesSection({ context, section }: { context: RenderContext; section: SectionOf<"dates"> }) {
  const { ends_at: endsAt, starts_at: startsAt } = context.campaign;

  if (!startsAt && !endsAt) {
    return null;
  }

  return (
    <SectionShell eyebrow="Calendario" heading={section.heading} id={section.id}>
      <dl className="grid gap-5 sm:grid-cols-2">
        {startsAt ? <DateCard label="Inicio" value={startsAt} /> : null}
        {endsAt ? <DateCard label="Cierre" value={endsAt} /> : null}
      </dl>
      <p className="mt-4 text-sm opacity-75">
        Hora de El Salvador.{section.note ? ` ${section.note}` : ""}
      </p>
    </SectionShell>
  );
}

function RichTextSection({ section }: { section: SectionOf<"rich_text"> }) {
  return (
    <SectionShell heading={section.heading || undefined} id={section.id}>
      <SafeMarkdown className="max-w-3xl text-lg">{section.body}</SafeMarkdown>
    </SectionShell>
  );
}

function ImageBannerSection({ section }: { section: SectionOf<"image_banner"> }) {
  const imageUrl = landingAssetUrl(section.image.path);

  if (!imageUrl) {
    return null;
  }

  return (
    <section className="px-4 py-10 sm:px-6">
      <figure className="mx-auto w-full max-w-5xl">
        <div className="pixel-frame relative aspect-[16/9] overflow-hidden sm:aspect-[21/9]">
          <Image alt={section.image.alt} className="object-cover" fill sizes="(min-width: 1024px) 1024px, 100vw" src={imageUrl} unoptimized />
        </div>
        {section.caption ? <figcaption className="mt-4 text-center text-sm opacity-75">{section.caption}</figcaption> : null}
      </figure>
    </section>
  );
}

function FaqSection({ section }: { section: SectionOf<"faq"> }) {
  return (
    <SectionShell eyebrow="Dudas" heading={section.heading} id={section.id}>
      <div className="max-w-3xl space-y-3">
        {section.items.map((item, index) => (
          <details className="pixel-frame-sm group bg-[var(--landing-card)]" key={`${section.id}-${index}`}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--accent)]">
              {item.question}
              <span aria-hidden="true" className="font-display text-2xl leading-none text-[var(--accent-strong)] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="-mt-2 whitespace-pre-line px-5 pb-5 leading-7 opacity-85">{item.answer}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function CtaSection({ context, section }: { context: RenderContext; section: SectionOf<"cta"> }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="pixel-frame relative mx-auto flex w-full max-w-5xl flex-col items-start gap-6 overflow-hidden bg-[var(--accent)] p-7 text-[var(--accent-contrast)] sm:flex-row sm:items-center sm:justify-between sm:p-12">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-1/2 bg-[repeating-linear-gradient(115deg,transparent_0_18px,rgb(0_0_0/0.12)_18px_30px)]" />
        <div className="relative">
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">{readableDigits(section.heading)}</h2>
          {section.body ? <p className="mt-3 max-w-xl text-lg opacity-90">{section.body}</p> : null}
        </div>
        <div className="relative w-full sm:w-auto [&>a]:w-full">
          <SecondaryLink href={ctaHref(section.target, context.signedIn)}>
            {context.signedIn && section.target !== "reglas" ? "Ir a mi pasaporte" : section.ctaLabel}
          </SecondaryLink>
        </div>
      </div>
    </section>
  );
}

const MEDALS: Readonly<Record<number, { color: string; label: string }>> = {
  1: { color: "#f5c542", label: "oro" },
  2: { color: "#c9d1dc", label: "plata" },
  3: { color: "#d08a4a", label: "bronce" },
};

function PodiumCard({ row, tall }: { row: RankingRow; tall: boolean }) {
  const avatar = getAvatar(row.avatar_id);
  const medal = MEDALS[row.standing];
  const name = row.alias ? `@${row.alias}` : (row.display_name ?? "Participante");

  return (
    <li
      className={`pixel-frame flex min-w-0 flex-col items-center bg-[var(--landing-card)] px-2 pb-4 text-center sm:px-3 ${tall ? "pt-6 sm:pb-10" : "pt-4"}`}
      style={medal ? ({ "--frame": medal.color } as CSSProperties) : undefined}
    >
      <span
        aria-label={medal ? `Puesto ${row.standing}, ${medal.label}` : `Puesto ${row.standing}`}
        className="grid size-9 place-items-center font-score text-lg text-[#0b1020]"
        role="img"
        style={{ background: medal?.color ?? "#e2e8f0" }}
      >
        {row.standing}
      </span>
      {avatar ? (
        <Image alt="" className={`pixelated mt-3 ${tall ? "size-16 sm:size-20" : "size-12 sm:size-14"}`} height={80} src={avatar.src} unoptimized width={80} />
      ) : null}
      <span className="mt-3 w-full truncate text-sm font-bold sm:text-base">{name}</span>
      {row.passport_hint ? <span className="w-full truncate text-xs opacity-70">{row.passport_hint}</span> : null}
      <span className="mt-2 font-score text-2xl leading-none">{numberFormat.format(row.points)}</span>
      <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">pts</span>
    </li>
  );
}

// Rows arrive already filtered by get_ranking (visibility and audience).
function RankingPreviewSection({ context, section }: { context: RenderContext; section: SectionOf<"ranking_preview"> }) {
  const rows = context.ranking.slice(0, section.limit);

  if (rows.length === 0) {
    return null;
  }

  // Before anyone scores, a list of zeros says nothing: invite to join instead.
  if (!rows.some((row) => row.points > 0)) {
    const startsAt = context.campaign.starts_at;
    const upcoming = isFuture(startsAt);

    return (
      <SectionShell eyebrow="Ranking" heading={section.heading} id={section.id}>
        <div className="pixel-frame relative overflow-hidden bg-[var(--landing-card)] p-6 sm:p-10 [--frame:var(--accent)]">
          <div aria-hidden="true" className="absolute -right-4 bottom-0 flex items-end gap-2 opacity-25 sm:right-10">
            <span className="h-16 w-10 bg-[var(--accent)] sm:h-20 sm:w-14" />
            <span className="h-24 w-10 bg-[var(--accent)] sm:h-32 sm:w-14" />
            <span className="h-12 w-10 bg-[var(--accent)] sm:h-14 sm:w-14" />
          </div>
          <p className="relative max-w-xl font-display text-2xl leading-tight sm:text-3xl">
            {upcoming ? "El podio está vacío. ¿Serás el primero?" : "Nadie ha sumado puntos todavía."}
          </p>
          <p className="relative mt-3 max-w-xl leading-7 opacity-85">
            {upcoming && startsAt
              ? `Crea tu pasaporte hoy y estarás listo cuando el ranking se encienda el ${formatInstant(startsAt)}`
              : "Responde la próxima trivia o completa una misión para aparecer en el Top."}
          </p>
          {!context.signedIn ? (
            <PrimaryLink className="relative mt-6" href="/registro">
              {context.primaryLabel}
            </PrimaryLink>
          ) : null}
        </div>
      </SectionShell>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  // Classic podium order: 2nd, 1st, 3rd.
  const ordered = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <SectionShell eyebrow="Ranking en vivo" heading={section.heading} id={section.id}>
      <ol aria-label="Podio" className={`grid items-end gap-2 sm:gap-5 ${podium.length === 3 ? "grid-cols-3" : "grid-cols-2"} max-w-3xl`}>
        {ordered.map((row) =>
          row ? <PodiumCard key={`${row.standing}-${row.alias ?? row.display_name}`} row={row} tall={row === podium[0]} /> : null,
        )}
      </ol>
      {rest.length > 0 ? (
        <div className="mt-6 max-w-3xl">
          <RankingTable dark={context.dark} highlightTop={section.limit} rows={rest} />
        </div>
      ) : null}
      {section.note ? <p className="mt-4 text-sm opacity-75">{section.note}</p> : null}
    </SectionShell>
  );
}

function UpcomingActivitiesSection({ context, section }: { context: RenderContext; section: SectionOf<"upcoming_activities"> }) {
  if (context.quizzes.length === 0) {
    return null;
  }

  return (
    <SectionShell eyebrow="Agenda" heading={section.heading} id={section.id}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {context.quizzes.map((quiz) => (
          <li key={quiz.title + quiz.opens_at}>
            <Card className="h-full">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                {quiz.phase === "active" ? <span aria-hidden="true" className="size-2 animate-pulse bg-[var(--accent)]" /> : null}
                {quiz.phase === "active" ? "Abierta ahora" : "Próximamente"}
              </p>
              <p className="mt-2 text-lg font-bold">{quiz.title}</p>
              <p className="mt-1 text-sm opacity-80 first-letter:uppercase">
                {quiz.phase === "active" ? `Cierra ${formatInstant(quiz.closes_at)}` : `Abre ${formatInstant(quiz.opens_at)}`}
              </p>
            </Card>
          </li>
        ))}
      </ul>
      {section.note ? <p className="mt-4 text-sm opacity-75">{section.note}</p> : null}
    </SectionShell>
  );
}

function LogosSection({ section }: { section: SectionOf<"logos"> }) {
  const logos = [
    ...(section.includeOrganizer ? [{ alt: "Digit@l Solutions", src: "/brand/digital-solutions.png" }] : []),
    ...section.logos.flatMap((logo) => {
      const src = landingAssetUrl(logo.path);
      return src ? [{ alt: logo.alt, src }] : [];
    }),
  ];

  if (logos.length === 0) {
    return null;
  }

  return (
    <section aria-label={section.heading || "Logos"} className="px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-5xl text-center">
        {section.heading ? <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70">{section.heading}</p> : null}
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-4">
          {logos.map((logo) => (
            <li className="pixel-frame-sm grid h-24 w-40 place-items-center bg-white p-3 sm:h-28 sm:w-48" key={logo.src}>
              <Image alt={logo.alt} className="max-h-full w-auto object-contain" height={88} src={logo.src} unoptimized width={176} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function renderSection(section: LandingSection, context: RenderContext) {
  switch (section.type) {
    case "hero":
      return <HeroSection context={context} section={section} />;
    case "prize":
      return <PrizeSection context={context} section={section} />;
    case "steps":
      return <StepsSection section={section} />;
    case "dates":
      return <DatesSection context={context} section={section} />;
    case "rich_text":
      return <RichTextSection section={section} />;
    case "image_banner":
      return <ImageBannerSection section={section} />;
    case "faq":
      return <FaqSection section={section} />;
    case "cta":
      return <CtaSection context={context} section={section} />;
    case "ranking_preview":
      return <RankingPreviewSection context={context} section={section} />;
    case "upcoming_activities":
      return <UpcomingActivitiesSection context={context} section={section} />;
    case "logos":
      return <LogosSection section={section} />;
  }
}

export function LandingPage({
  campaign,
  content,
  quizzes = [],
  ranking = [],
  signedIn,
}: {
  campaign: PublicCampaign;
  content: LandingContent;
  quizzes?: readonly PublicQuiz[];
  ranking?: readonly RankingRow[];
  signedIn: boolean;
}) {
  const dark = content.theme.surface === "oscuro";
  const sections = content.sections.filter((section) => section.visible);
  const hero = sections.find((section) => section.type === "hero");
  const primaryLabel = hero?.type === "hero" ? hero.primaryCtaLabel : "Crear mi pasaporte";
  const context: RenderContext = { campaign, dark, primaryLabel, quizzes, ranking, signedIn };
  const logoUrl = landingAssetUrl(content.theme.logo?.path);
  // In-page anchors for the menu: the first visible section of each kind.
  const anchors = new Map<string, string>();
  const navLinks: SiteNavLink[] = [];

  for (const section of sections) {
    const target = SECTION_ANCHORS[section.type];
    const rendersRanking = section.type !== "ranking_preview" || ranking.length > 0;

    if (target && rendersRanking && !navLinks.some((link) => link.href === `#${target.anchor}`)) {
      anchors.set(section.id, target.anchor);
      navLinks.push({ href: `#${target.anchor}`, label: target.label });
    }
  }

  navLinks.push({ href: "/reglas", label: "Reglas" });
  const surface = dark
    ? {
        // On dark surfaces the darker "strong" shade lacks contrast; use the light tint.
        "--accent-strong": "var(--accent-on-dark)",
        "--frame": DARK_SURFACE.frame,
        "--landing-card": DARK_SURFACE.card,
        "--landing-page": DARK_SURFACE.page,
      }
    : { "--frame": "var(--color-ink)", "--landing-card": "#ffffff", "--landing-page": "var(--color-paper)" };

  return (
    <div
      className={`min-h-screen bg-[var(--landing-page)] ${dark ? "text-white" : "text-[var(--color-ink)]"}`}
      style={{ ...themeStyle(content.theme), ...surface } as CSSProperties}
    >
      <SiteHeaderView
        campaignName={campaign.name}
        dark={dark}
        links={navLinks}
        logo={logoUrl ? { alt: content.theme.logo?.alt || campaign.name, url: logoUrl } : null}
        signedIn={signedIn}
      />

      <main>
        {sections.map((section) => (
          <div className="scroll-mt-16" id={anchors.get(section.id)} key={section.id}>
            {renderSection(section, context)}
          </div>
        ))}
      </main>

      <footer
        className={`border-t-2 border-[var(--frame)] px-4 pt-8 ${signedIn ? "pb-8" : "pb-28 sm:pb-8"}`}
      >
        <LegalLinks />
      </footer>

      {/* Persistent call to action on phones: the page's main conversion goal. */}
      {!signedIn ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[var(--frame)] bg-[var(--landing-page)]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <PrimaryLink className="w-full" href="/registro">
            {primaryLabel}
          </PrimaryLink>
        </div>
      ) : null}
    </div>
  );
}
