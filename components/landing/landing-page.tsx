import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { LegalLinks } from "@/components/legal/legal-page";
import { SafeMarkdown } from "@/components/markdown/safe-markdown";
import { RankingTable } from "@/components/points/ranking-table";
import type { PublicCampaign } from "@/lib/campaign/queries";
import type { RankingRow } from "@/lib/points/queries";
import type { PublicQuiz } from "@/lib/quiz/queries";
import { landingAssetUrl } from "@/lib/landing/assets";
import type { CtaTarget, LandingContent, LandingSection, SectionOf } from "@/lib/landing/schema";
import { themeStyle } from "@/lib/landing/theme";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

interface RenderContext {
  campaign: PublicCampaign;
  dark: boolean;
  quizzes: readonly PublicQuiz[];
  ranking: readonly RankingRow[];
  signedIn: boolean;
}

function ctaHref(target: CtaTarget, signedIn: boolean): string {
  if (target === "reglas") {
    return "/reglas";
  }

  return signedIn ? "/app/perfil" : target === "login" ? "/login" : "/registro";
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

function PrimaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="pixel-button inline-flex min-h-12 items-center justify-center bg-[var(--accent)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[var(--accent-contrast)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      href={href}
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="pixel-button inline-flex min-h-12 items-center justify-center bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-[var(--color-ink)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      href={href}
    >
      {children}
    </Link>
  );
}

function SectionShell({
  children,
  heading,
  id,
}: {
  children: ReactNode;
  heading?: string;
  id: string;
}) {
  return (
    <section aria-labelledby={heading ? `${id}-heading` : undefined} className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        {heading ? (
          <h2
            className="font-display text-3xl leading-tight tracking-tight sm:text-4xl"
            id={`${id}-heading`}
          >
            {heading}
          </h2>
        ) : null}
        <div className={heading ? "mt-8" : undefined}>{children}</div>
      </div>
    </section>
  );
}

function Card({ children, dark }: { children: ReactNode; dark: boolean }) {
  return (
    <div className={`pixel-frame p-5 sm:p-6 ${dark ? "bg-[#141b33]" : "bg-white"}`}>{children}</div>
  );
}

function HeroSection({ context, section }: { context: RenderContext; section: SectionOf<"hero"> }) {
  const imageUrl = landingAssetUrl(section.image?.path);
  const primary = (
    <PrimaryLink href={ctaHref("registro", context.signedIn)}>
      {context.signedIn ? "Ir a mi cuenta" : section.primaryCtaLabel}
    </PrimaryLink>
  );
  const secondary =
    section.secondaryCtaLabel && !context.signedIn ? (
      <SecondaryLink href="/login">{section.secondaryCtaLabel}</SecondaryLink>
    ) : null;
  const copy = (
    <>
      {section.eyebrow ? (
        <p className="inline-block bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-contrast)]">
          {section.eyebrow}
        </p>
      ) : null}
      <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
        {section.headline}
      </h1>
      {section.subtitle ? (
        <p className="mt-5 max-w-xl text-lg leading-8 opacity-85 sm:text-xl">{section.subtitle}</p>
      ) : null}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        {primary}
        {secondary}
      </div>
    </>
  );

  if (section.layout === "background" && imageUrl) {
    return (
      <section className="relative isolate overflow-hidden px-4 py-24 text-white sm:px-6 sm:py-32">
        <Image
          alt={section.image?.alt ?? ""}
          className="-z-20 object-cover"
          fill
          priority
          sizes="100vw"
          src={imageUrl}
          unoptimized
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#0b1020]/70" />
        <div className="mx-auto w-full max-w-5xl">{copy}</div>
      </section>
    );
  }

  if (section.layout === "centered") {
    return (
      <section className="pixel-grid px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center [&_p]:mx-auto">{copy}</div>
        {imageUrl ? (
          <div className="pixel-frame relative mx-auto mt-12 aspect-[16/9] w-full max-w-4xl overflow-hidden">
            <Image alt={section.image?.alt ?? ""} className="object-cover" fill priority sizes="(min-width: 1024px) 896px, 100vw" src={imageUrl} unoptimized />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="pixel-grid px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>{copy}</div>
        {imageUrl ? (
          <div className="pixel-frame relative aspect-square w-full overflow-hidden bg-[var(--accent-soft)]">
            <Image alt={section.image?.alt ?? ""} className="object-cover" fill priority sizes="(min-width: 1024px) 420px, 100vw" src={imageUrl} unoptimized />
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
    <SectionShell heading={section.heading} id={section.id}>
      <div className={`grid items-center gap-8 ${imageUrl ? "md:grid-cols-2" : ""}`}>
        {imageUrl ? (
          <div className="pixel-frame relative aspect-[4/3] overflow-hidden bg-[var(--accent-soft)]">
            <Image alt={section.image?.alt ?? ""} className="object-cover" fill sizes="(min-width: 768px) 480px, 100vw" src={imageUrl} unoptimized />
          </div>
        ) : null}
        <Card dark={context.dark}>
          {title ? <p className="font-display text-2xl text-[var(--accent-strong)] sm:text-3xl">{title}</p> : null}
          {description ? <p className="mt-4 whitespace-pre-line leading-7 opacity-90">{description}</p> : null}
          {section.note ? <p className="mt-4 text-sm leading-6 opacity-75">{section.note}</p> : null}
        </Card>
      </div>
    </SectionShell>
  );
}

function StepsSection({ context, section }: { context: RenderContext; section: SectionOf<"steps"> }) {
  return (
    <SectionShell heading={section.heading} id={section.id}>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {section.steps.map((step, index) => (
          <li key={`${section.id}-${index}`}>
            <Card dark={context.dark}>
              <span
                aria-hidden="true"
                className="pixel-frame-sm inline-grid size-10 place-items-center bg-[var(--accent)] font-display text-lg text-[var(--accent-contrast)]"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              {step.body ? <p className="mt-2 leading-7 opacity-85">{step.body}</p> : null}
            </Card>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

function DatesSection({ context, section }: { context: RenderContext; section: SectionOf<"dates"> }) {
  const startsAt = formatInstant(context.campaign.starts_at);
  const endsAt = formatInstant(context.campaign.ends_at);

  if (!startsAt && !endsAt) {
    return null;
  }

  return (
    <SectionShell heading={section.heading} id={section.id}>
      <dl className="grid gap-6 sm:grid-cols-2">
        {startsAt ? (
          <Card dark={context.dark}>
            <dt className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Inicio</dt>
            <dd className="mt-2 text-lg font-semibold first-letter:uppercase">{startsAt}</dd>
          </Card>
        ) : null}
        {endsAt ? (
          <Card dark={context.dark}>
            <dt className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Cierre</dt>
            <dd className="mt-2 text-lg font-semibold first-letter:uppercase">{endsAt}</dd>
          </Card>
        ) : null}
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
        <div className="pixel-frame relative aspect-[21/9] overflow-hidden">
          <Image alt={section.image.alt} className="object-cover" fill sizes="(min-width: 1024px) 1024px, 100vw" src={imageUrl} unoptimized />
        </div>
        {section.caption ? <figcaption className="mt-4 text-center text-sm opacity-75">{section.caption}</figcaption> : null}
      </figure>
    </section>
  );
}

function FaqSection({ context, section }: { context: RenderContext; section: SectionOf<"faq"> }) {
  return (
    <SectionShell heading={section.heading} id={section.id}>
      <div className="space-y-4">
        {section.items.map((item, index) => (
          <details
            className={`pixel-frame-sm group p-5 ${context.dark ? "bg-[#141b33]" : "bg-white"}`}
            key={`${section.id}-${index}`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
              {item.question}
              <span aria-hidden="true" className="font-display text-xl text-[var(--accent-strong)] group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-line leading-7 opacity-85">{item.answer}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function CtaSection({ context, section }: { context: RenderContext; section: SectionOf<"cta"> }) {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="pixel-frame mx-auto flex w-full max-w-5xl flex-col items-start gap-6 bg-[var(--accent)] p-8 text-[var(--accent-contrast)] sm:flex-row sm:items-center sm:justify-between sm:p-12">
        <div>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">{section.heading}</h2>
          {section.body ? <p className="mt-3 max-w-xl text-lg opacity-90">{section.body}</p> : null}
        </div>
        <SecondaryLink href={ctaHref(section.target, context.signedIn)}>
          {context.signedIn && section.target !== "reglas" ? "Ir a mi cuenta" : section.ctaLabel}
        </SecondaryLink>
      </div>
    </section>
  );
}

// Rows arrive already filtered by get_ranking (visibility and audience).
function RankingPreviewSection({ context, section }: { context: RenderContext; section: SectionOf<"ranking_preview"> }) {
  const rows = context.ranking.slice(0, section.limit);

  if (rows.length === 0) {
    return null;
  }

  return (
    <SectionShell heading={section.heading} id={section.id}>
      <div className="max-w-3xl">
        <RankingTable dark={context.dark} highlightTop={section.limit} rows={rows} />
        {section.note ? <p className="mt-4 text-sm opacity-75">{section.note}</p> : null}
      </div>
    </SectionShell>
  );
}

function UpcomingActivitiesSection({ context, section }: { context: RenderContext; section: SectionOf<"upcoming_activities"> }) {
  if (context.quizzes.length === 0) {
    return null;
  }

  return (
    <SectionShell heading={section.heading} id={section.id}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {context.quizzes.map((quiz) => (
          <li key={quiz.title + quiz.opens_at}>
            <Card dark={context.dark}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
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

function renderSection(section: LandingSection, context: RenderContext) {
  switch (section.type) {
    case "hero":
      return <HeroSection context={context} section={section} />;
    case "prize":
      return <PrizeSection context={context} section={section} />;
    case "steps":
      return <StepsSection context={context} section={section} />;
    case "dates":
      return <DatesSection context={context} section={section} />;
    case "rich_text":
      return <RichTextSection section={section} />;
    case "image_banner":
      return <ImageBannerSection section={section} />;
    case "faq":
      return <FaqSection context={context} section={section} />;
    case "cta":
      return <CtaSection context={context} section={section} />;
    case "ranking_preview":
      return <RankingPreviewSection context={context} section={section} />;
    case "upcoming_activities":
      return <UpcomingActivitiesSection context={context} section={section} />;
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
  const context: RenderContext = { campaign, dark, quizzes, ranking, signedIn };
  const logoUrl = landingAssetUrl(content.theme.logo?.path);

  return (
    <div
      className={dark ? "min-h-screen bg-[#0b1020] text-white [--frame:#e8ecff]" : "min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]"}
      // On dark surfaces the darker "strong" shade lacks contrast; use the accent.
      style={{ ...themeStyle(content.theme), ...(dark ? { "--accent-strong": "var(--accent)" } : {}) }}
    >
      <header className={`border-b-4 ${dark ? "border-[#e8ecff]" : "border-[var(--color-ink)]"}`}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="flex items-center gap-3 font-display text-xl" href="/">
            {logoUrl ? (
              <Image alt={content.theme.logo?.alt || campaign.name} className="h-9 w-auto" height={36} src={logoUrl} unoptimized width={120} />
            ) : null}
            <span>{campaign.name}</span>
          </Link>
          <nav aria-label="Cuenta" className="flex items-center gap-4 text-sm font-semibold">
            {signedIn ? (
              <Link className="underline-offset-4 hover:underline" href="/app/perfil">
                Mi cuenta
              </Link>
            ) : (
              <>
                <Link className="underline-offset-4 hover:underline" href="/login">
                  Iniciar sesión
                </Link>
                <Link className="hidden underline-offset-4 hover:underline sm:inline" href="/registro">
                  Registrarse
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {content.sections
          .filter((section) => section.visible)
          .map((section) => (
            <div key={section.id}>{renderSection(section, context)}</div>
          ))}
      </main>

      <footer className={`border-t-4 px-4 py-8 ${dark ? "border-[#e8ecff] [&_a]:text-white/80" : "border-[var(--color-ink)]"}`}>
        <LegalLinks />
      </footer>
    </div>
  );
}
