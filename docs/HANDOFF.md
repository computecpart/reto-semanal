# Traspaso del proyecto — Reto Semanal

Documento de contexto para continuar el desarrollo en otra sesión o cuenta.
Actualizado: 21 de octubre de 2026 (fin de la Fase 1).

## 1. Qué es y calendario

Plataforma de gamificación para una campaña empresarial de ~8 semanas con ~100
participantes en El Salvador (español, zona `America/El_Salvador`). Los
participantes se registran, completan retos (cuestionarios, códigos/QR en
vivo), acumulan puntos y compiten en un ranking por un premio (p. ej. una PC).

Calendario acordado con el responsable:

- **Jueves 22/10/2026:** pruebas del sistema ya desplegado.
- **Viernes 23/10/2026:** apertura a usuarios reales.
- **Sábado 24/10/2026:** primer uso real con actividad.

**No existe entorno demo.** El único proyecto Supabase es producción y ya tiene
usuarios reales (ver §3). Cada cambio posterior se hace con usuarios activos.

## 2. Estado funcional verificado

Fases completas: **Prompt 0 (foundation)** y **Prompt 1 (auth, roles, perfil)**.
Todo lo siguiente se probó contra el proyecto real:

- Registro con todos los campos obligatorios → correo de confirmación →
  `/app/perfil` → edición de perfil.
- `/admin` rechaza a `participant` (redirige a `/app/perfil?acceso=denegado`) y
  admite a `superadmin`.
- Bootstrap del primer superadmin ejecutado y auditado; es de un solo uso.
- Con la clave pública: perfiles, roles, RPC privados y el esquema `private`
  devuelven 401/404; solo `is_alias_available` es público.
- `npm run check` (lint, typecheck, 124 tests, build) en verde.

Rutas existentes:

| Ruta | Acceso | Notas |
| --- | --- | --- |
| `/` | Público | Portada provisional; el Prompt 2 la rediseña |
| `/registro` | Público | Dinámica (`connection()`), la fecha operativa no se congela en build |
| `/verificar-correo` | Público | OTP de 6 dígitos (acepta 6–10), reenvío con cooldown de 60 s |
| `/login`, `/forgot-password`, `/reset-password` | Público / sesión de recuperación | |
| `/auth/callback` | Público | PKCE de recuperación de contraseña → `/reset-password` |
| `/auth/confirm` | Público | Alternativa: enlace de confirmación de alta (si la plantilla envía enlace) |
| `/reglas`, `/privacidad` | Público | **Textos estáticos genéricos; el organizador debe revisarlos** |
| `/app/perfil` | Sesión | Ver/editar; completar perfil para cuentas sin datos |
| `/admin` | admin/superadmin | Placeholder protegido |

## 3. Infraestructura

### Supabase (producción)

| Dato | Valor |
| --- | --- |
| Proyecto | `reto-semanal-prod` (renombrado desde `reto-semanal-demo`) |
| Ref | `dsrddyibtgfzaafsqhac` |
| URL | `https://dsrddyibtgfzaafsqhac.supabase.co` |
| Región / Postgres | `us-east-1` / 17 |
| Plan | Pro (organización) |
| Migraciones aplicadas | `20261020000000`, `20261020010000`, `20261020020000` |
| Usuarios | 1: `computecpart@gmail.com`, alias `computerds`, **superadmin** |

Configuración de Auth aplicada por la Management API:

- Confirm email ON, signups ON, anónimos y teléfono OFF.
- OTP de email: 6 dígitos, 3600 s. Contraseña mínima 8 + **HaveIBeenPwned ON**.
- Plantillas en español: confirmación (`{{ .Token }}`), recuperación
  (`{{ .ConfirmationURL }}`), cambio de correo y reautenticación.
- Límites por IP ampliados para registro masivo desde una red corporativa
  compartida: `rate_limit_verify=300`, `rate_limit_otp=150`,
  `rate_limit_token_refresh=900` (por 5 min).
- `site_url` y `uri_allow_list`: ver §3 Vercel/dominio (se actualizan al desplegar).

Pendiente en Supabase (**bloqueante para usuarios reales**):

- **SMTP propio.** El correo integrado solo envía a miembros del equipo del
  proyecto y ~2 correos/hora. Sin SMTP, nadie más recibe el código. Después de
  configurarlo, subir `rate_limit_email_sent` (p. ej. 200/h).
  Gmail (contraseñas de aplicación no disponibles para la cuenta) y Brevo fallaron.
  Recomendado con dominio propio: Resend (integración nativa en Supabase) o Brevo
  autenticado por dominio. Para el día de apertura, 100 registros + reenvíos
  pueden superar 100 correos/día (límite del plan gratuito de Resend).

### Vercel, dominio y GitHub

- GitHub: `origin = https://github.com/computecpart/reto-semanal.git`. Sin push
  hecho todavía; requiere autorización explícita.
- Vercel (Pro) y dominio: ver §8 «Estado de despliegue» al final de este documento.

### Secretos (nunca imprimir ni pegar en el chat)

| Archivo (ignorado por git) | Contenido |
| --- | --- |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `.env.seed.local` | `SUPABASE_ACCESS_TOKEN` (token de la Management API, scope: este proyecto, **caduca ~28/10/2026**), `SUPABASE_SECRET_KEY`, refs, `SUPABASE_ENVIRONMENT=production`, `SEED_SUPERADMIN_EMAIL`, `VERCEL_TOKEN` |

El token de Supabase se expuso en una conversación: revocarlo y crear otro
(scope proyecto, ~7 días) cuando haga falta. Renovarlo durante las 8 semanas.

## 4. Arquitectura y convenciones (obligatorias para mantener coherencia)

**Next.js 16.4 / React 19.3 / TS 5.9 estricto / Tailwind 4 / Zod 4 / Vitest 5.**
Next 16 usa `proxy.ts` (no `middleware.ts`). Antes de usar APIs de Next, leer la
guía correspondiente en `node_modules/next/dist/docs/`.

- **Clientes Supabase:** `lib/supabase/client.ts` (navegador),
  `lib/supabase/server.ts` (RSC/acciones), `lib/supabase/proxy.ts` (refresco de
  sesión + redirección optimista de `/app` y `/admin`). Nunca hay cliente con
  secret key en el runtime web.
- **Autorización de servidor:** `lib/auth/get-auth-context.ts`
  (`getAuthContext`, cacheado por request, usa `auth.getUser()` + RPC
  `get_my_role`). Guardas `requireSessionPage(path)` y `requireAdminPage()` en
  `lib/auth/guards.ts`. **Cada página admin llama `requireAdminPage()`**, además
  del layout. Las acciones de servidor verifican sesión otra vez.
- **Roles:** `private.user_roles` (esquema no expuesto por la Data API);
  `public.get_my_role()`. Nunca `user_metadata`.
- **Escrituras:** solo por RPC `security definer` con `set search_path = ''`,
  nombres calificados (`public.`, `private.`, `pg_catalog.`), `revoke all ...
  from public, anon` y `grant execute ... to authenticated` explícito. Los
  clientes no tienen `INSERT/UPDATE/DELETE` sobre tablas. Errores con
  `raise exception using errcode, message` en español.
- **Mapeo de errores RPC:** lista blanca de mensajes en
  `lib/profile/rpc-errors.ts`; cualquier otro mensaje se sustituye por uno
  genérico. Replicar el patrón por dominio.
- **Extensiones:** esquema `extensions`. `unaccent` exige la forma de dos
  argumentos con diccionario calificado (bug corregido en `20261020020000`).
- **Acciones de servidor:** `"use server"` en `lib/<dominio>/actions.ts`,
  validación Zod, llamada RPC, `revalidatePath`. Estado en `lib/profile/form-state.ts`.
- **Formularios cliente:** `useActionState` + `onSubmit` con
  `startTransition(() => formAction(formData))`. No usar `<form action>`
  directo con campos no controlados: React 19 los reinicia tras un error.
- **Navegación cliente:** `useRouter()`; `window.location.assign` está
  prohibido por lint. No llamar `setState` síncrono dentro de `useEffect`
  (regla `react-hooks/set-state-in-effect`); usar `useSyncExternalStore` o
  callbacks.
- **Fechas:** `getOperationalDate()` (fecha civil en El Salvador). Las reglas de
  edad usan la misma semántica que PostgreSQL (`date + interval 'N years'`).
  Páginas que dependan de "hoy" deben ser dinámicas (`await connection()`).
  Los instantes críticos los genera PostgreSQL (`statement_timestamp()`/`now()`).
- **Validación:** `lib/validation/profile.ts` (alias, nombres, departamentos,
  edad, avatares). Alias: normalización y filtro reservado/ofensivo duplicados
  en TS y SQL (`private.blocked_alias_terms`).
- **Avatares:** 12 SVG en `public/avatars/`, generados por
  `scripts/generate-avatars.mjs` (`npm run avatars:generate`); catálogo en
  `lib/avatars.ts`; restricción SQL `^avatar-(0[1-9]|1[0-2])$`. Si se añaden
  avatares, actualizar los tres sitios y la restricción en una migración nueva.
- **Tests:** `tests/*.test.ts`. `tests/migrations.test.ts` verifica invariantes
  estáticas del SQL (RLS en toda tabla creada, grants, RPCs); ampliarlo en cada
  fase. Los módulos `.mjs` importados en tests necesitan su `.d.mts`.
- **Migraciones:** `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`, envueltas en
  `begin; ... commit;`, aditivas. Última: `20261020020000`.
- **UI actual:** sobria (slate/sky). El Prompt 2 introduce el sistema visual
  pixel-art definitivo.

## 5. Modelo de datos actual

- `public.profiles` (RLS: select propio): `first_name`, `last_name`, `alias`
  (único `lower(alias)`), `birth_date`, `age_declaration` (`minor|adult`),
  `department` (enum de 14), `avatar_id`, `rules_accepted_at`,
  `privacy_accepted_at`, `profile_completed_at`, `display_name`, timestamps.
- `private.user_roles` (`participant|admin|superadmin`), `private.role_audit_log`,
  `private.bootstrap_state`, `private.blocked_alias_terms`.
- Trigger `private.handle_new_user`: crea perfil desde metadata de registro
  validada y rol `participant`; rechaza metadata con `role`, `points`,
  `disciplinary_status`. Usuarios creados sin esa metadata (p. ej. desde el
  panel) son rechazados.
- RPCs: `get_my_role`, `is_alias_available` (anon), `update_my_profile`,
  `complete_my_profile`, `bootstrap_first_superadmin` (solo service_role).

Aún **no existen**: campañas, puntos, estado disciplinario, auditoría general,
versionado de reglas.

## 6. Decisiones pendientes del responsable

1. **Actividad del sábado 24:** ¿cuestionario, código/QR en vivo o ambos? Define
   qué fases deben estar en producción antes del sábado.
2. **Menores de edad:** el registro los admite. ¿Pueden ganar el premio? ¿Se
   exige autorización del representante?
3. **Textos legales:** `/reglas` y `/privacidad` son borradores genéricos sin
   nombre de la empresa organizadora ni canal de contacto.
4. **Proveedor SMTP** y presupuesto de envíos.
5. **Identidad en ranking** (alias, nombre o ambos) y criterio de desempate.

## 7. Riesgos abiertos

- SMTP no configurado (bloqueante).
- Aceptación de reglas sin versión (se resuelve en el Prompt 2; los usuarios
  existentes deberán aceptar la versión vigente).
- Sin Content-Security-Policy ni CAPTCHA en registro (valorar Turnstile/hCaptcha
  si hay abuso).
- Las vistas previas de Vercel no deben apuntar a la base de producción.
- Backups: Pro incluye diarios (7 días); PITR es un add-on opcional.

## 8. Estado de despliegue

Al cierre de la sesión del 21/10/2026:

| Elemento | Estado |
| --- | --- |
| Supabase producción | Listo (migraciones, Auth, plantillas, superadmin) |
| `site_url` / Redirect URLs | Solo `localhost:3000`; **actualizar al dominio real** |
| SMTP propio | **Pendiente (bloqueante)** |
| Vercel | **Pendiente**: proyecto, variables Production y despliegue |
| Dominio | **Pendiente**: el responsable tiene un dominio gratuito por un año (aún sin nombre ni configuración) |
| Git | Commit local `Fases 0 y 1`; **sin push** a `origin` |

Para completar lo pendiente, ejecutar `docs/prompts/01b-despliegue-produccion.md`.

## 9. Comandos

```bash
npm run dev                       # desarrollo local (usa .env.local → PRODUCCIÓN)
npm run check                     # lint + typecheck + tests + build
npm run avatars:generate
node scripts/supabase-mgmt.mjs query "select ..."      # solo lectura
node scripts/supabase-mgmt.mjs auth:get [claves]
node scripts/supabase-mgmt.mjs auth:patch cambios.json
npx supabase db push --dry-run    # revisar SIEMPRE antes de aplicar
npx supabase db push              # solo con autorización explícita
```

`npm run dev` local apunta a la base de **producción**: no crear cuentas de
prueba masivas ni datos ficticios desde local.
