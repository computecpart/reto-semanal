import type { Metadata } from "next";
import Image from "next/image";

import { FormStatus } from "@/components/auth/form-ui";
import { ProfileCompletionForm } from "@/components/profile/profile-completion-form";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";
import { requireSessionPage } from "@/lib/auth/guards";
import { getAvatar } from "@/lib/avatars";
import { getMyProfile } from "@/lib/profile/my-profile";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";
import { getOperationalDate } from "@/lib/validation/profile";

export const metadata: Metadata = {
  title: "Mi perfil | Reto Semanal",
};

const ROLE_LABELS = {
  admin: "Administrador",
  participant: "Participante",
  superadmin: "Superadministrador",
} as const;

function formatCivilDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatInstant(value: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "long",
    timeZone: OPERATIONAL_TIME_ZONE,
  }).format(new Date(value));
}

interface ProfilePageProps {
  searchParams: Promise<{ acceso?: string | string[] }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const { role, user } = await requireSessionPage("/app/perfil");
  const [profile, params] = await Promise.all([getMyProfile(user.id), searchParams]);
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
      <div className="space-y-6">
        {accessDenied ? (
          <FormStatus>No tienes permiso para acceder al área de administración.</FormStatus>
        ) : null}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-bold tracking-tight">Completa tu perfil</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tu cuenta existía antes del registro completo. Necesitamos estos datos para que
            puedas participar.
          </p>
          <div className="mt-8">
            <ProfileCompletionForm operationalDate={getOperationalDate(new Date())} />
          </div>
        </section>
      </div>
    );
  }

  const avatar = getAvatar(profile.avatar_id);

  return (
    <div className="space-y-6">
      {accessDenied ? (
        <FormStatus>No tienes permiso para acceder al área de administración.</FormStatus>
      ) : null}

      <section className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        {avatar ? (
          <Image
            alt={`Avatar ${avatar.label}`}
            className="size-24 rounded-2xl [image-rendering:pixelated]"
            height={96}
            priority
            src={avatar.src}
            unoptimized
            width={96}
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
            {ROLE_LABELS[role]}
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight">@{profile.alias}</h1>
          <p className="mt-1 text-slate-600">
            {profile.first_name} {profile.last_name}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="account-data-heading"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-lg font-bold" id="account-data-heading">
          Datos de la cuenta
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Estos datos no se pueden modificar desde el perfil.
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-500">Correo</dt>
            <dd className="mt-0.5 break-all text-slate-900">{user.email}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Rol</dt>
            <dd className="mt-0.5 text-slate-900">{ROLE_LABELS[role]}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Fecha de nacimiento</dt>
            <dd className="mt-0.5 text-slate-900">
              {profile.birth_date ? formatCivilDate(profile.birth_date) : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Declaración de edad</dt>
            <dd className="mt-0.5 text-slate-900">
              {profile.age_declaration === "adult" ? "Mayor de edad" : "Menor de edad"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Miembro desde</dt>
            <dd className="mt-0.5 text-slate-900">{formatInstant(profile.profile_completed_at)}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="edit-profile-heading"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-lg font-bold" id="edit-profile-heading">
          Editar perfil
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Puedes cambiar tu nombre, apellido, alias, departamento y avatar.
        </p>
        <div className="mt-6">
          <ProfileEditForm profile={profile} />
        </div>
      </section>
    </div>
  );
}
