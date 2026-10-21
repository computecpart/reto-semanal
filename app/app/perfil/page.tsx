import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FormStatus, PixelCard, SectionTitle } from "@/components/auth/form-ui";
import { ContactForm } from "@/components/profile/contact-form";
import { ProfileCompletionForm } from "@/components/profile/profile-completion-form";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { requireSessionPage } from "@/lib/auth/guards";
import { getAvatar } from "@/lib/avatars";
import { isAdministrativeRole } from "@/lib/permissions/roles";
import { getMyParticipantStatus, getMyPoints } from "@/lib/points/queries";
import { getMyProfile } from "@/lib/profile/my-profile";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";
import { formatSalvadorPhone, getOperationalDate } from "@/lib/validation/profile";

export const metadata: Metadata = {
  title: "Mi pasaporte",
};

const ROLE_LABELS = {
  admin: "Administrador",
  participant: "Participante",
  superadmin: "Superadministrador",
} as const;

const STATUS_NOTICES: Readonly<Record<string, string>> = {
  archived: "Tu cuenta está archivada. Contacta al equipo organizador si crees que es un error.",
  disqualified:
    "Tu cuenta fue descalificada de la competencia. Contacta al equipo organizador para más información.",
  suspended: "Tu cuenta está suspendida temporalmente: no puedes sumar puntos por ahora.",
};

function formatCivilDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("es-SV", { dateStyle: "long", timeZone: OPERATIONAL_TIME_ZONE }).format(
    new Date(value),
  );
}

interface ProfilePageProps {
  searchParams: Promise<{ acceso?: string | string[] }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const { role, user } = await requireSessionPage("/app/perfil");
  const [profile, params, points, status] = await Promise.all([
    getMyProfile(user.id),
    searchParams,
    getMyPoints().catch(() => null),
    getMyParticipantStatus(),
  ]);
  const accessDenied = params.acceso === "denegado";

  if (!profile) {
    return (
      <FormStatus>
        No encontramos tu perfil. Cierra sesión y vuelve a ingresar; si el problema continúa,
        contacta al equipo organizador.
      </FormStatus>
    );
  }

  if (!profile.profile_completed_at) {
    return (
      <PixelCard>
        <SectionTitle description="Tu cuenta existía antes del registro completo. Necesitamos estos datos para que puedas participar.">
          Completa tu pasaporte
        </SectionTitle>
        <ProfileCompletionForm operationalDate={getOperationalDate(new Date())} />
      </PixelCard>
    );
  }

  const avatar = getAvatar(profile.avatar_id);
  const competes = !isAdministrativeRole(role);
  const statusNotice = status ? STATUS_NOTICES[status] : undefined;

  return (
    <div className="space-y-8">
      {accessDenied ? <FormStatus>No tienes permiso para acceder al área de administración.</FormStatus> : null}
      {statusNotice ? <FormStatus>{statusNotice}</FormStatus> : null}
      {!profile.phone ? (
        <FormStatus tone="info">
          Agrega tu teléfono en «Datos de contacto»: lo necesitamos para contactarte si ganas.
        </FormStatus>
      ) : null}

      {/* Passport card */}
      <section aria-label="Pasaporte" className="pixel-frame overflow-hidden bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--accent)] px-5 py-3 text-[var(--accent-contrast)] sm:px-8">
          <p className="font-display text-lg">Pasaporte de participante</p>
          <p className="font-mono text-sm font-bold tracking-[0.2em]">N.º {profile.passport_code}</p>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-8">
          {avatar ? (
            <Image
              alt={`Avatar ${avatar.label}`}
              className="pixelated size-28 border-4 border-[var(--color-ink)] bg-[var(--accent-soft)]"
              height={112}
              priority
              src={avatar.src}
              unoptimized
              width={112}
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{ROLE_LABELS[role]}</p>
            <h1 className="mt-1 break-words font-display text-3xl leading-tight sm:text-4xl">@{profile.alias}</h1>
            <p className="mt-1 text-slate-600">
              {profile.first_name} {profile.last_name} · {profile.department}
            </p>

            {competes && points ? (
              <dl className="mt-6 grid max-w-md grid-cols-2 gap-3">
                <div className="pixel-frame-sm bg-[var(--color-paper)] p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Puntos</dt>
                  <dd className="mt-1 font-display text-3xl">{new Intl.NumberFormat("es-SV").format(points.total)}</dd>
                </div>
                <div className="pixel-frame-sm bg-[var(--color-paper)] p-3">
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Posición</dt>
                  <dd className="mt-1 font-display text-3xl">{points.standing ? `#${points.standing}` : "—"}</dd>
                </div>
              </dl>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              {competes ? (
                <>
                  <Link className="pixel-button bg-[var(--accent)] px-4 py-2 font-bold uppercase tracking-wide text-[var(--accent-contrast)]" href="/app/puntos">
                    Ver mis puntos
                  </Link>
                  <Link className="pixel-button bg-white px-4 py-2 font-bold uppercase tracking-wide" href="/app/ranking">
                    Ver ranking
                  </Link>
                </>
              ) : (
                <p className="text-slate-600">Las cuentas del equipo organizador no compiten en el ranking.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <PixelCard>
          <SectionTitle description="Solo el equipo organizador lo ve. Se usa para contactarte si ganas." id="contact-heading">
            Datos de contacto
          </SectionTitle>
          <ContactForm marketingConsent={Boolean(profile.marketing_consent_at)} phone={profile.phone} />
        </PixelCard>

        <PixelCard>
          <SectionTitle description="Estos datos no se pueden modificar desde el perfil." id="account-heading">
            Datos de la cuenta
          </SectionTitle>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Correo", user.email ?? "—"],
              ["Teléfono", formatSalvadorPhone(profile.phone) || "Sin registrar"],
              ["Fecha de nacimiento", profile.birth_date ? formatCivilDate(profile.birth_date) : "—"],
              ["Declaración de edad", profile.age_declaration === "adult" ? "Mayor de edad" : "Menor de edad"],
              ["Miembro desde", formatInstant(profile.profile_completed_at)],
              ["Identificador", profile.passport_code],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-1 break-all font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </PixelCard>
      </div>

      <PixelCard>
        <SectionTitle description="Puedes cambiar tu nombre, apellido, alias, departamento y avatar." id="edit-profile-heading">
          Editar perfil
        </SectionTitle>
        <ProfileEditForm profile={profile} />
      </PixelCard>
    </div>
  );
}
