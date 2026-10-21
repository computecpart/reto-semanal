# Reto Semanal

Plataforma empresarial de gamificación para aproximadamente 100 participantes
durante una campaña de ocho semanas.

## Estado

- **Fase 0 — Foundation:** Next.js App Router, TypeScript estricto, Tailwind,
  `@supabase/ssr`, roles privados y RLS.
- **Fase 1 — Autenticación, roles y perfil:** registro, verificación de correo
  con código OTP dentro de la app, reenvío con cooldown, login, logout,
  recuperación de contraseña, `/app/perfil`, `/admin` protegido y bootstrap del
  primer superadmin.

- **Fase 2 — Campañas y portada:** campañas con estados, portada compuesta por
  secciones editable desde el admin (borrador, vista previa, publicación e
  historial), reglas versionadas con aceptación registrada, auditoría inmutable y
  sistema visual pixel-art.

Producción: **https://piensads.app**. Aún no existen puntos, ranking,
cuestionarios, recompensas QR ni moderación.

**Estado de infraestructura, convenciones y siguientes fases:** ver
[`docs/HANDOFF.md`](docs/HANDOFF.md) y [`docs/prompts/`](docs/prompts/README.md).
El proyecto Supabase enlazado es **producción**.

## Versiones

- Next.js `16.4.2`, React `19.3.1`, TypeScript `5.9.3`, Tailwind CSS `4.3.3`
- `@supabase/ssr` `0.12.7`, `@supabase/supabase-js` `2.118.0`, Zod `4.6.7`

TypeScript se fija en `5.9.3` porque el parser de la cadena ESLint de Next.js 16
solo admite versiones menores que 6.1.

## Rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/registro` | Público | Alta con todos los datos obligatorios |
| `/verificar-correo` | Público | Código OTP y reenvío con cooldown de 60 s |
| `/login` | Público | Inicio de sesión |
| `/forgot-password` | Público | Envío del enlace de recuperación |
| `/auth/callback` | Público | Intercambio PKCE del enlace de recuperación |
| `/auth/confirm` | Público | Alternativa: enlace de confirmación de registro (si la plantilla aún no envía el código) |
| `/reset-password` | Sesión de recuperación | Nueva contraseña |
| `/reglas`, `/privacidad` | Público | Textos legales (borradores a revisar por el organizador) |
| `/aceptar-reglas` | Sesión | Aceptar una versión importante de las reglas |
| `/admin/campana/...` | admin/superadmin | Datos, estado, editor de portada y reglas |
| `/vista-previa/portada/[id]` | admin/superadmin | Vista previa del borrador |
| `/app/perfil` | Sesión | Ver, editar o completar el perfil |
| `/admin` | `admin` o `superadmin` | Un `participant` es redirigido con acceso denegado |

## Modelo de seguridad

- El rol vive en `private.user_roles` y se lee con `public.get_my_role()`.
  `user_metadata` nunca participa en autorización.
- Todo alta crea `participant` desde el trigger `private.handle_new_user`. El
  trigger rechaza metadata con `role`, `points` o `disciplinary_status`.
- Los clientes no tienen `UPDATE` sobre `public.profiles`. La edición pasa por
  `public.update_my_profile`, que solo modifica nombre, apellido, alias,
  departamento y avatar del propio usuario.
- Fecha de nacimiento, declaración de edad y consentimientos no se pueden
  modificar después de completar el perfil.
- El alias se normaliza y valida en la app **y** en PostgreSQL (índice único
  case-insensitive, términos reservados y filtro ofensivo local privado).
- La coherencia edad/declaración se calcula con la fecha civil de
  `America/El_Salvador`, con la misma semántica en TypeScript y PostgreSQL.
- `/admin` se protege en tres capas: redirección optimista en `proxy.ts`,
  guarda en el layout y guarda en cada página.
- Avatares: catálogo cerrado de 12 SVG pixel-art originales en
  `public/avatars/`, regenerables con `npm run avatars:generate`. No hay subida
  de fotografías.

## Desarrollo local

Requisitos: Node.js 24 y npm 11.

```bash
npm install
cp .env.example .env.local   # URL y publishable key del proyecto DEMO
npm run dev
```

## Configuración de Supabase

Ya aplicada en producción por la Management API (ver `docs/HANDOFF.md` §3).
Referencia para recrearla en otro proyecto:

1. **Migraciones**, en orden (ver «Aplicar migraciones»).
2. **Authentication → Sign In / Providers → Email**
   - Email provider: habilitado.
   - Confirm email: **activado**.
   - Email OTP length: 6 (la app acepta de 6 a 10 dígitos).
   - Email OTP expiration: 3600 s o menos.
   - Minimum password length: 8.
3. **Authentication → Emails → Templates → Confirm signup**: el cuerpo debe
   incluir `{{ .Token }}` (el código), no solo `{{ .ConfirmationURL }}`:

   ```html
   <h2>Confirma tu correo</h2>
   <p>Tu código de verificación para Reto Semanal es:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Escríbelo en la pantalla «Verifica tu correo». Expira en una hora.</p>
   <p>Si no creaste esta cuenta, ignora este mensaje.</p>
   ```

   La plantilla **Reset password** puede quedarse con `{{ .ConfirmationURL }}`.
4. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (demo local) o el dominio definitivo.
   - Redirect URLs: `http://localhost:3000/auth/callback`,
     `http://localhost:3000/auth/confirm` y, más adelante, sus equivalentes
     `https://<dominio>/...`.
5. **Authentication → Rate Limits**: mantener el intervalo mínimo entre correos
   en 60 s (coincide con el cooldown visual).
6. **SMTP (obligatorio para el código OTP)**: en el plan gratuito Supabase no
   permite editar plantillas con el correo integrado, y ese correo solo llega a
   miembros del equipo del proyecto con un límite muy bajo. Hasta configurar un
   SMTP propio (**Authentication → Emails → SMTP Settings**) el correo trae un
   enlace, que la app acepta en `/auth/confirm`. Después aplique la plantilla
   del punto 3.

Los usuarios creados desde el panel de Supabase sin metadata de registro son
rechazados por el trigger; todas las cuentas se crean desde `/registro`.

## Aplicar migraciones

Requiere autorización explícita. El proyecto enlazado es producción: revisar
siempre con `--dry-run` antes de aplicar.

Con Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <DEMO_PROJECT_REF>
npx supabase db push --dry-run   # revisar la lista de migraciones
npx supabase db push
```

Alternativa: en **SQL Editor**, ejecutar el contenido de cada archivo de
`supabase/migrations/` en orden de nombre:

1. `20261020000000_foundation.sql`
2. `20261020010000_auth_profiles.sql`
3. `20261020020000_alias_unaccent_fix.sql`

## Primer superadmin

1. La persona se registra en `/registro`, verifica el código y entra a su perfil.
2. Copie `.env.seed.example` a `.env.seed.local` y complete:
   `SUPABASE_ENVIRONMENT` (`local`, `demo` o `production`), `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `SUPABASE_PROJECT_REF`,
   `EXPECTED_SUPABASE_PROJECT_REF` y `SEED_SUPERADMIN_EMAIL`.
3. Ejecute:

   ```bash
   npm run bootstrap:superadmin -- --confirm=<PROJECT_REF>
   # producción requiere además --allow-production
   ```

El RPC solo acepta la credencial `service_role`, solo promueve a un
`participant` confirmado con perfil completo, registra la promoción en
`private.role_audit_log` y se niega si ya existe un superadmin.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

También puede ejecutarse la secuencia completa con `npm run check`.
