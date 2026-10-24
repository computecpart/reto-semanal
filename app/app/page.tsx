import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PixelIcon, type PixelIconName } from "@/components/app/pixel-icons";
import { PixelBarChart, PixelMeter, SegmentProgress } from "@/components/dashboard/pixel-charts";
import { readableDigits } from "@/components/ui/readable-digits";
import { requireSessionPage } from "@/lib/auth/guards";
import { getAvatar } from "@/lib/avatars";
import { getPublicLanding } from "@/lib/campaign/queries";
import { campaignProgress, nextGoal, pointsBreakdown, pointsByWeek, type NextGoal } from "@/lib/dashboard/stats";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { getMyPoints, getRanking } from "@/lib/points/queries";
import { getMyProfile } from "@/lib/profile/my-profile";
import { listMyQuizzes } from "@/lib/quiz/queries";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

export const metadata: Metadata = {
  title: "Inicio",
};

export const dynamic = "force-dynamic";

const numberFormat = new Intl.NumberFormat("es-SV");
const pointsLabel = (value: number) => `${numberFormat.format(value)} ${value === 1 ? "punto" : "puntos"}`;

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: OPERATIONAL_TIME_ZONE,
    weekday: "short",
  }).format(new Date(value));
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`pixel-frame min-w-0 bg-white p-4 sm:p-6 ${className}`}>{children}</section>;
}

function CardTitle({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-xl leading-tight sm:text-2xl">{typeof children === "string" ? readableDigits(children) : children}</h2>
      {action}
    </div>
  );
}

function MoreLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link className="inline-flex min-h-10 shrink-0 items-center text-sm font-bold text-[var(--accent-strong)] hover:underline" href={href}>
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

function goalText(goal: NextGoal | null, started: boolean): string {
  if (!started) {
    return "Cuando empiece la campaña, aquí verás cuánto te falta para subir en el ranking.";
  }

  if (!goal) {
    return "Responde una trivia o completa una misión para entrar al ranking.";
  }

  if (goal.kind === "lead") {
    return `¡Vas en primer lugar! Le llevas ${pointsLabel(goal.margin)} al segundo.`;
  }

  return goal.kind === "top"
    ? `Te faltan ${pointsLabel(goal.missing)} para entrar al Top ${goal.top}.`
    : `Te faltan ${pointsLabel(goal.missing)} para alcanzar el puesto #${goal.target}.`;
}

const ACTIONS: readonly { description: string; href: string; icon: PixelIconName; label: string }[] = [
  { description: "Responde y suma puntos", href: "/app/cuestionarios", icon: "quiz", label: "Trivias" },
  { description: "Código o QR de una misión", href: "/app/canjear", icon: "qr", label: "Canjear" },
  { description: "Tabla de posiciones", href: "/app/ranking", icon: "trophy", label: "Ranking" },
  { description: "Historial de movimientos", href: "/app/puntos", icon: "points", label: "Mis puntos" },
];

export default async function DashboardPage() {
  const { role, user } = await requireSessionPage("/app");
  const [profile, points, ranking, quizzes, landing] = await Promise.all([
    getMyProfile(user.id),
    getMyPoints().catch(() => null),
    getRanking(500).catch(() => []),
    listMyQuizzes().catch(() => []),
    getPublicLanding().catch(() => null),
  ]);

  if (!profile?.profile_completed_at) {
    redirect("/app/perfil");
  }

  const competes = !isAdministrativeRole(role);
  const avatar = getAvatar(profile.avatar_id);
  const campaign = landing?.campaign;
  const progress = campaign ? campaignProgress(new Date(), campaign.starts_at, campaign.ends_at) : null;
  const events = points?.events ?? [];
  const total = points?.total ?? 0;
  // With nobody scoring, everyone ties at #1: only show a position once there are points.
  const standing = (points?.total ?? 0) > 0 ? (points?.standing ?? null) : null;
  const weekly = campaign?.starts_at && progress ? pointsByWeek(events, campaign.starts_at, progress.weeks) : [];
  const breakdown = pointsBreakdown(events);
  const breakdownMax = Math.max(breakdown.quizzes, breakdown.speed, breakdown.missions, 1);
  const goal = competes && standing ? nextGoal(ranking, { points: total, standing }) : null;
  const available = quizzes.filter((quiz) => quiz.phase === "active" && (quiz.attempt_status === null || quiz.attempt_status === "started"));
  const upcoming = quizzes.filter((quiz) => quiz.phase === "upcoming").sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const answered = quizzes.filter((quiz) => quiz.attempt_status !== null && quiz.attempt_status !== "started").length;
  const missions = events.filter((event) => event.kind === "mission").length;
  const top = ranking.filter((row) => row.points > 0).slice(0, 5);
  const competitors = ranking.length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Player card */}
      <section className="pixel-frame overflow-hidden bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-[var(--accent)] px-4 py-2.5 text-[var(--accent-contrast)] sm:px-6">
          <p className="font-display text-base sm:text-lg">Base de operaciones</p>
          <p className="font-score text-xs tracking-[0.2em]">N.º {profile.passport_code}</p>
        </div>
        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-4">
            {avatar ? (
              <Image alt="" className="pixelated size-16 shrink-0 border-4 border-[var(--color-ink)] bg-white sm:size-20" height={80} src={avatar.src} unoptimized width={80} />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Hola,</p>
              <h1 className="truncate font-display text-3xl leading-tight sm:text-4xl">@{profile.alias}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {competes ? goalText(goal, progress?.phase !== "upcoming") : "Las cuentas del equipo organizador no compiten en el ranking."}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="pixel-frame-sm bg-[var(--accent-soft)] px-3 py-2 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Puntos</dt>
              <dd className="font-score text-2xl sm:text-3xl">{numberFormat.format(total)}</dd>
            </div>
            <div className="pixel-frame-sm bg-white px-3 py-2 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Posición</dt>
              <dd className="font-score text-2xl sm:text-3xl">{competes && standing ? `#${standing}` : "—"}</dd>
            </div>
            <div className="pixel-frame-sm bg-white px-3 py-2 text-center">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Misiones</dt>
              <dd className="font-score text-2xl sm:text-3xl">{missions}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Campaign progress + quick actions */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardTitle>La aventura</CardTitle>
          {progress ? (
            <>
              <p className="font-score text-3xl">
                {progress.phase === "upcoming" ? "Muy pronto" : progress.phase === "ended" ? "Finalizada" : `Semana ${progress.week} de ${progress.weeks}`}
              </p>
              <div className="mt-3">
                <SegmentProgress done={progress.week} label={`Semana ${progress.week} de ${progress.weeks}`} total={progress.weeks} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {progress.phase === "upcoming" && campaign?.starts_at
                  ? `Empieza el ${formatInstant(campaign.starts_at)}. ¡Prepárate!`
                  : progress.phase === "active"
                    ? `Quedan ${progress.daysLeft} días para el cierre.`
                    : "La campaña terminó. Revisa el ranking final."}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Las fechas de la campaña se anunciarán pronto.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Accesos rápidos</CardTitle>
          <ul className="grid grid-cols-2 gap-3">
            {ACTIONS.map((action) => {
              const badge = action.href === "/app/cuestionarios" && available.length > 0 ? available.length : null;

              return (
                <li key={action.href}>
                  <Link
                    className="pixel-button relative flex h-full min-h-20 flex-col items-start gap-2 bg-white p-3 sm:flex-row sm:items-center sm:gap-3 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
                    href={action.href}
                  >
                    <span className="grid size-10 shrink-0 place-items-center bg-[var(--accent)] text-[var(--accent-contrast)]">
                      <PixelIcon className="size-6" name={action.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold">{action.label}</span>
                      <span className="hidden text-xs leading-snug text-slate-600 sm:block">{action.description}</span>
                    </span>
                    {badge ? (
                      <span className="absolute -top-2 -right-2 grid size-7 place-items-center border-2 border-[var(--color-ink)] bg-[var(--accent)] font-score text-sm text-[var(--accent-contrast)]">
                        {badge}
                        <span className="sr-only"> trivias disponibles</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Trivias module */}
      <Card>
        <CardTitle action={<MoreLink href="/app/cuestionarios">Ver todas</MoreLink>}>Trivias</CardTitle>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Disponibles ahora</p>
            {available.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {available.slice(0, 3).map((quiz) => (
                  <li className="pixel-frame-sm flex flex-wrap items-center justify-between gap-3 bg-[var(--accent-soft)] p-3" key={quiz.id}>
                    <span className="min-w-0">
                      <span className="block font-bold">{readableDigits(quiz.title)}</span>
                      <span className="block text-xs text-slate-600">
                        Hasta {numberFormat.format(quiz.max_points)} pts · cierra {formatInstant(quiz.closes_at)}
                      </span>
                    </span>
                    <Link
                      className="pixel-button inline-flex min-h-10 items-center bg-[var(--accent)] px-4 text-sm font-bold uppercase text-[var(--accent-contrast)]"
                      href={`/app/cuestionarios/${quiz.id}`}
                    >
                      {quiz.attempt_status === "started" ? "Continuar" : "Responder"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No hay trivias abiertas en este momento.</p>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Próxima</p>
              {upcoming[0] ? (
                <p className="mt-1">
                  <span className="block font-bold">{readableDigits(upcoming[0].title)}</span>
                  <span className="text-sm text-slate-600">Abre {formatInstant(upcoming[0].opens_at)}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">Pronto anunciaremos la siguiente.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Completadas</p>
              <p className="font-score text-2xl">
                {answered} <span className="text-base text-slate-500">de {quizzes.length}</span>
              </p>
              {quizzes.length > 0 ? <SegmentProgress done={answered} label={`${answered} de ${quizzes.length} trivias`} total={Math.min(quizzes.length, 12)} /> : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardTitle action={<MoreLink href="/app/puntos">Historial</MoreLink>}>Puntos por semana</CardTitle>
          {weekly.length > 0 ? (
            <PixelBarChart
              current={progress?.phase === "active" ? progress.week - 1 : -1}
              labels={weekly.map((_, index) => `S${index + 1}`)}
              summary={weekly.map((value, index) => `Semana ${index + 1}: ${value} puntos`).join(". ")}
              values={weekly}
            />
          ) : (
            <p className="text-sm text-slate-600">El gráfico aparecerá cuando empiece la campaña.</p>
          )}
        </Card>

        <Card>
          <CardTitle>De dónde vienen</CardTitle>
          {total !== 0 || events.length > 0 ? (
            <div className="space-y-4">
              <PixelMeter color="var(--accent)" label="Trivias" max={breakdownMax} value={breakdown.quizzes} />
              <PixelMeter color="#f2a516" label="Bonos de velocidad" max={breakdownMax} value={breakdown.speed} />
              <PixelMeter color="var(--color-ink)" label="Misiones" max={breakdownMax} value={breakdown.missions} />
              {breakdown.adjustments !== 0 ? (
                <p className="text-xs text-slate-500">Ajustes del equipo organizador: {numberFormat.format(breakdown.adjustments)} pts.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Aún no tienes puntos. Tu primera trivia o misión aparecerá aquí.</p>
          )}
        </Card>
      </div>

      {/* Ranking + activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle action={<MoreLink href="/app/ranking">Ranking</MoreLink>}>Top 5</CardTitle>
          {top.length > 0 ? (
            <ol className="space-y-2">
              {top.map((row) => {
                const rowAvatar = getAvatar(row.avatar_id);

                return (
                  <li
                    className={`flex items-center gap-3 border-2 p-2 ${row.is_current_user ? "border-[var(--color-ink)] bg-[var(--accent-soft)]" : "border-slate-200"}`}
                    key={`${row.standing}-${row.alias}`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center font-score ${row.standing === 1 ? "bg-[#f5c542]" : row.standing === 2 ? "bg-[#c9d1dc]" : row.standing === 3 ? "bg-[#d08a4a]" : "bg-slate-100"}`}
                    >
                      {row.standing}
                    </span>
                    {rowAvatar ? <Image alt="" className="pixelated size-9 shrink-0" height={36} src={rowAvatar.src} unoptimized width={36} /> : null}
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {row.alias ? `@${row.alias}` : (row.display_name ?? "Participante")}
                      {row.is_current_user ? <span className="ml-1 text-xs uppercase"> (tú)</span> : null}
                    </span>
                    <span className="font-score">{numberFormat.format(row.points)}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-slate-600">
              {competitors > 0 ? "El podio está vacío: los primeros puntos te pueden poner arriba." : "El ranking aún no está visible."}
            </p>
          )}
          {competes && standing && standing > 5 ? (
            <p className="mt-3 text-sm font-semibold">
              Tu posición: <span className="font-score">#{standing}</span> de {competitors}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardTitle action={<MoreLink href="/app/puntos">Ver todo</MoreLink>}>Actividad reciente</CardTitle>
          {events.length > 0 ? (
            <ul className="divide-y-2 divide-dashed divide-slate-200">
              {events.slice(0, 5).map((event) => (
                <li className="flex items-center justify-between gap-3 py-2.5" key={event.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{event.description}</span>
                    <span className="text-xs text-slate-500">{formatInstant(event.created_at)}</span>
                  </span>
                  <span className={`shrink-0 font-score text-lg ${event.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {event.amount > 0 ? "+" : ""}
                    {numberFormat.format(event.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <PixelIcon className="size-8 shrink-0 text-[var(--accent)]" name="flag" />
              Tu historial empieza con tu primera trivia o misión.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
