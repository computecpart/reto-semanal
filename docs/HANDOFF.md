# Traspaso del proyecto — Reto Semanal

Contexto completo para continuar el desarrollo en otra sesión o cuenta de Claude
Code. Actualizado: **21 de octubre de 2026, fin de la Fase 2**. Léelo entero antes
de tocar código.

## 0. ESTADO ACTUAL (22/10/2026, Fases 3, 4 y 5 completas y desplegadas)

- **Producción al día** con el repo: migraciones hasta `20261021100000` aplicadas; despliegue en Vercel
  con la Fase 3. `npm run check` en verde con 218 tests.
- **Campaña publicada:** «MSI Passport — The Dragon Journey» (`a89d3a8e-…`, slug `msi-passport`),
  23/10/2026 08:00 → 11/12/2026 23:59 hora SV, premio «Equipo MSI» por rifa, tema carmesí/oscuro,
  reglas v2 (importante) = `docs/campaign/msi-passport-reglas.md`, ranking visible y público
  (alias + identificador parcial, Top 5). Cargada con las RPC admin auditadas a nombre del superadmin.
- **Fase 3 entregada:** teléfono obligatorio en el alta, consentimiento comercial, `passport_code`,
  estado del participante, ledger `point_events` inmutable e idempotente, `private.award_points`
  (punto único de puntuación automática para las Fases 4 y 5), ranking con desempates de la regla 7,
  `/app/puntos`, `/app/ranking`, `/admin/ranking` (configuración, ajuste manual auditado,
  reversión con movimiento compensatorio), sección de portada `ranking_preview`.
- **UX:** participante y acceso con estilo pixel y el tema de la campaña (`AuthShell`, `AppHeader`,
  `components/auth/form-ui.tsx`: `PixelCard`, `SectionTitle`…); perfil como «pasaporte»; admin con
  barra lateral (`components/admin/admin-shell.tsx`) y kit sobrio `components/admin/admin-ui.tsx`;
  editor de portada con autoguardado.
- **Misiones presenciales:** en `/admin/misiones` (código/QR). El «Ajuste manual» de `/admin/ranking` queda para correcciones.
- **Fase 4 entregada (22/10):** migraciones `20261022000000_quizzes` y `20261022010000_quiz_guard_fix`.
  Trivias con claves en `private.quiz_answer_keys`, intento único (`unique(quiz_id,user_id)`), plazo del
  servidor (`least(closes_at, started_at+duración)`), autoguardado, envío idempotente, finalización perezosa
  de intentos vencidos, bono de velocidad lineal × acierto MC (`private.speed_bonus`, espejo TS en
  `lib/quiz/schema.ts`), bloqueo por trigger tras el primer intento (solo título, descripción, cierre y
  visibilidad editables; «Duplicar»), revisiones de respuestas abiertas con corrección compensatoria y ranking
  provisional. Rutas: `/app/cuestionarios`, `/app/cuestionarios/[id]`, `/admin/cuestionarios` (`/nuevo`,
  `/[id]`, `/[id]/vista-previa`), `/admin/revisiones`. Sección de portada `upcoming_activities`.
  Flujo completo verificado en producción dentro de una transacción revertida.
- **Limitaciones conocidas:** `award_points` exige la campaña dentro de `starts_at…ends_at`, así que las
  revisiones de respuestas abiertas deben hacerse **antes del cierre** de la campaña. Imagen por cuestionario
  (bucket `quiz-images`) no implementada. Los admins no pueden responder trivias (usan la vista previa).
- **Fase 5 entregada (22/10):** migración `20261022020000_missions`. Misiones con código `XXXX-XXXX`
  (alfabeto sin ambigüedades, muestreo por rechazo) en `private.reward_codes`; QR = enlace propio
  `/app/canjear?c=CODIGO` generado en servidor (`qrcode@1.5.4`, PNG/SVG); abrir el enlace nunca canjea
  (vista previa + «Confirmar canje»); `unique(user_id, reward_id)` para código y QR; límite de 10 fallos /
  10 min (las RPC devuelven `{ok:false}` en vez de lanzar para que el registro persista); escáner con
  `BarcodeDetector` (sin librería; si no existe, se usa la cámara del teléfono o el código) que solo acepta
  enlaces propios; login conserva el código vía `getSafePostLoginPath`. Rutas: `/app/canjear`,
  `/admin/misiones`, `/admin/misiones/[id]` (código, QR, regenerar, canjes), `/[id]/presentar` (pantalla
  completa), `/[id]/canjes` (CSV con protección contra fórmulas). Puntos: `award_points(kind=mission)`.
  Verificado en producción con transacción revertida. **No implementado:** logo dentro del QR / bucket `branding`.
- **Siguiente:** Fase 6 (`docs/prompts/06-moderacion-admin.md`) + **herramienta de rifa** (reglas 8 y 11:
  sorteo aleatorio y verificable entre participantes elegibles, independiente de los puntos).
- Los usuarios existentes deben aceptar las reglas v2 al entrar a `/app` (comportamiento esperado).

## 1. Qué es y calendario

Plataforma de gamificación para una campaña empresarial de ~8 semanas con ~100
participantes en El Salvador (español, zona `America/El_Salvador`, UTC-6 sin
horario de verano). Los participantes se registran, completan retos
(cuestionarios, códigos/QR en vivo), acumulan puntos y compiten en un ranking
por un premio (p. ej. una PC).

- **Jueves 22/10/2026:** pruebas del sistema desplegado.
- **Viernes 23/10/2026:** apertura a usuarios reales.
- **Sábado 24/10/2026:** primer uso real con actividad.

**No existe entorno demo.** El único proyecto Supabase y el único despliegue son
**producción**. Cada cambio se hace con usuarios reales activos.

Responsable: Luis Escarate (cuenta `computecpart@gmail.com`, superadmin de la app).

## 2. Estado funcional verificado

Fases completas y desplegadas en **https://piensads.app**: 0 (foundation),
1 (auth, roles, perfil), 3 (puntos y ranking) y 2 (campañas, portada por secciones, reglas
versionadas, auditoría base, sistema visual). `npm run check` en verde con 176
tests.

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/` | Público | Portada compuesta por secciones publicadas; sin campaña muestra «Próximamente» |
| `/registro`, `/verificar-correo`, `/login`, `/forgot-password`, `/reset-password` | Público | Auth con OTP de 6 dígitos (la app acepta 6–10) |
| `/auth/callback` | Público | PKCE de recuperación → `/reset-password` |
| `/auth/confirm` | Público | Alternativa: enlace de confirmación de alta |
| `/reglas` | Público | Versión vigente desde la BD (Markdown seguro); sin campaña, texto genérico |
| `/privacidad` | Público | Estática; **borrador genérico a revisar por el organizador** |
| `/aceptar-reglas` | Sesión | Puerta cuando hay una versión importante sin aceptar |
| `/app/perfil` | Sesión | Ver, editar y completar el perfil |
| `/admin` | admin/superadmin | Panel con la campaña actual |
| `/admin/campana` | admin/superadmin | Lista y creación de campañas |
| `/admin/campana/[id]` | admin/superadmin | Datos (nombre, slug, fechas, premio) y cambio de estado |
| `/admin/campana/[id]/portada` | admin/superadmin | **Editor de portada tipo Shopify** |
| `/admin/campana/[id]/reglas` | admin/superadmin | Publicar nueva versión de reglas e historial |
| `/vista-previa/portada/[id]` | admin/superadmin | Borrador renderizado con el renderer público |

### Primeros pasos operativos pendientes del responsable (en la app)

1. `/admin/campana` → crear la campaña (se crea en borrador con una portada de
   ejemplo).
2. Pestaña **Datos**: fechas de inicio y cierre (hora de El Salvador) y premio.
3. Pestaña **Reglas**: publicar la versión 1, con premio, desempate y si los
   menores pueden ganar.
4. Pestaña **Portada**: editar secciones, subir imágenes, elegir tema → **Publicar**.
5. Pestaña **Datos** → Estado → **Publicada**. Publicar exige fechas, reglas y
   portada publicadas.

## 3. Infraestructura

### Supabase (producción)

| Dato | Valor |
| --- | --- |
| Proyecto | `reto-semanal-prod`, ref `dsrddyibtgfzaafsqhac`, `us-east-1`, Postgres 17 |
| URL | `https://dsrddyibtgfzaafsqhac.supabase.co` |
| Plan | Pro, **Spend Cap ON** (≈ $25/mes; no crear proyectos ni add-ons extra) |
| Migraciones | `20261020000000`, `20261020010000`, `20261020020000`, `20261021000000` |
| Usuarios | 1: `computecpart@gmail.com`, alias `computerds`, superadmin (bootstrap ya usado) |
| Storage | Bucket público `landing-assets` (PNG/JPEG/WebP, ≤ 3 MB, escritura solo admin) |

Auth aplicada por la Management API:

- Confirm email ON, signups ON, anónimos y teléfono OFF.
- OTP: 6 dígitos y 3600 s. Contraseña mínima 8 + **HaveIBeenPwned ON**.
- Plantillas en español: confirmación (`{{ .Token }}`), recuperación
  (`{{ .ConfirmationURL }}`), cambio de correo y reautenticación.
- Límites por IP ampliados para la red corporativa compartida:
  `rate_limit_verify=300`, `rate_limit_otp=150`, `rate_limit_token_refresh=900`.
- **SMTP propio (Resend):** remitente `"Reto Semanal" <no-reply@piensads.app>`, `smtp.resend.com:465`, usuario `resend`, contraseña = clave de **solo envío** `RESEND_SMTP_KEY`. Dominio verificado en Resend (DKIM, SPF y MX en `send`, CNAME `rsend`, DMARC `p=none`, todo en Vercel DNS). `rate_limit_email_sent=100`/h. Plan gratis de Resend: **100 correos/día, 3000/mes**. Entrega verificada el 21/10/2026.
- `site_url=https://piensads.app`. Redirect URLs: `https://piensads.app/auth/callback`,
  `https://piensads.app/auth/confirm` y sus equivalentes en `localhost:3000`.

### Vercel (producción)

| Dato | Valor |
| --- | --- |
| Proyecto | `reto-semanal`, equipo `computecpart` (`team_GtixyaLKYtbs1Q4lpZM5IzIi`), `prj_8ZdQpJI9D86r8pbuD0REpfqsdGIS` |
| Runtime | Node 24, región `iad1` (misma zona que Supabase) |
| Variables | Solo **Production**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca la secret key |
| Dominio | `piensads.app` (registrado en Vercel, DNS de Vercel, gratis hasta 21/10/2027, renovación automática OFF). `www` y `http` → 308 |
| Protección | Previews y `*.vercel.app` con Vercel Authentication |
| Costes | Pro $20/mes. Presupuesto on-demand $1 con «Pause production deployments». Observability Plus debe estar OFF |
| Despliegue | CLI desde local (`vercel deploy --prod`). **Sin integración Git** |

Imágenes: se usa `next/image` con `unoptimized` para no generar cargos de Image
Optimization; no hace falta `remotePatterns`.

### GitHub

`origin = https://github.com/computecpart/reto-semanal.git` (rama `main`, al día desde el 21/10/2026).
Este equipo usa **siempre la cuenta GitHub `computecpart`**: el repo tiene `credential.https://github.com.username=computecpart` y la sesión está en Git Credential Manager. **No usar** la cuenta `programacionds03-dev`. `.claude/settings.local.json` (no versionado) permite `git push` sin confirmación. Integración Git de Vercel: no conectada (despliegue por CLI).

### Secretos (nunca imprimir ni pegar en el chat)

| Archivo (ignorado por git) | Contenido |
| --- | --- |
| `.env.local` | Variables públicas de Supabase + `VERCEL_OIDC_TOKEN` (lo añade la CLI) |
| `.env.seed.local` | `SUPABASE_ACCESS_TOKEN` (scope: este proyecto, **caduca ~28/10/2026**), `SUPABASE_SECRET_KEY`, refs, `SUPABASE_ENVIRONMENT=production`, `SEED_SUPERADMIN_EMAIL`, `VERCEL_TOKEN` (**caduca ~28/10/2026**), `RESEND_API_KEY` (acceso completo, solo para administrar Resend), `RESEND_SMTP_KEY` (solo envío, la usa Supabase) |

`.vercelignore` impide subir archivos `.env`. El token de Supabase se pegó una vez
en un chat: revocarlo al terminar y crear otro cuando haga falta. Ambos tokens
deben renovarse durante las 8 semanas.

## 4. Pendientes bloqueantes

1. ~~SMTP propio~~ **Resuelto el 21/10/2026** (ver §3). Vigilar el límite de 100 correos/día de Resend el día de apertura; si se alcanza, el responsable decide si sube a un plan de pago.
3. **Contenido real:** campaña, reglas definitivas (premio, desempate,
   menores) y revisión de `/privacidad` (nombre del organizador y contacto).

## 5. Arquitectura y convenciones (obligatorias)

**Next.js 16.4 / React 19.3 / TS 5.9 estricto / Tailwind 4 / Zod 4 / Vitest 5 /
react-markdown 10.1.** Next 16 usa `proxy.ts` (no `middleware.ts`). Antes de usar
una API de Next, leer su guía en `node_modules/next/dist/docs/`.

### Servidor y autorización

- **Clientes Supabase:**
  - `lib/supabase/client.ts` (navegador);
  - `lib/supabase/server.ts` (RSC y acciones);
  - `lib/supabase/proxy.ts`: refresco de sesión y redirección optimista de
    `/app`, `/admin`, `/vista-previa` y `/aceptar-reglas`. Al añadir rutas
    protegidas, ampliar `PROTECTED_PATH` y `ADMIN_PATH`.
- **Guardas** (`lib/auth/guards.ts`): `requireSessionPage(path)` y
  `requireAdminPage()`. **Cada página admin llama `requireAdminPage()`**, además
  del layout. `getAuthContext()` está cacheado por request.
- **Roles:** `private.user_roles`; `public.get_my_role()`; `public.is_admin()`
  (para RLS y Storage). Nunca `user_metadata`.
- **Escrituras:** solo por RPC `security definer` con `set search_path = ''`,
  nombres calificados, `revoke all ... from public, anon` y `grant execute ...
  to authenticated`. Los clientes no tienen `INSERT`, `UPDATE` ni `DELETE`
  sobre tablas.
- **RPC administrativa (plantilla):**
  1. `perform private.require_role('admin', 'superadmin');`
  2. `select ... for update` de la fila afectada;
  3. validar y mutar;
  4. `perform private.write_audit(accion, tipo, id, campaign_id, before, after, reason);`
- **Acción de auditoría:** formato `dominio.verbo`, por ejemplo
  `campaign.status` o `landing.publish`.
- **Errores:** `raise exception using errcode, message` en español. Mapeo por
  lista blanca en `lib/<dominio>/rpc-errors.ts`; cualquier otro mensaje se
  sustituye por uno genérico.
- **Campaña actual:** `private.current_campaign_id()` devuelve la publicada o,
  si no hay, la cerrada o finalizada más reciente. Todas las tablas futuras
  llevan `campaign_id`.
- **Server actions:** `"use server"` en `lib/<dominio>/actions.ts`. Cada acción
  verifica la sesión o el rol, valida con Zod, llama al RPC y ejecuta
  `revalidatePath`. Estado tipado `ActionState`
  (`lib/profile/form-state.ts`).

### Cliente

- **Formularios:** el hook `useTransitionForm` de
  `components/admin/campaign-forms.tsx` combina `useActionState` y
  `onSubmit + startTransition`. No usar `<form action>` directo con campos no
  controlados: React 19 los reinicia tras un error. Conviene extraer el hook a
  `lib/forms` si se reutiliza.
- **Navegación:** `useRouter()`. `window.location.assign` está prohibido por
  lint. Tampoco se puede llamar `setState` síncrono dentro de `useEffect`.

### Fechas

- `getOperationalDate()` devuelve la fecha civil.
- `salvadorLocalToIso()` e `isoToSalvadorLocal()` convierten los
  `datetime-local` del admin.
- Las páginas que dependen de «hoy» deben ser dinámicas.
- Los instantes críticos los genera PostgreSQL.

### Portada por secciones (`lib/landing/*`)

- `schema.ts` define una unión discriminada de secciones: `hero`, `prize`,
  `steps`, `dates`, `rich_text`, `image_banner`, `faq` y `cta`.
  - Las imágenes son **rutas** del bucket (`campaigns/<uuid>/<uuid>.ext`),
    nunca URLs.
  - Los CTA tienen destinos fijos.
  - `readLandingContent()` descarta secciones inválidas al renderizar.
- `defaults.ts` (`createSection`, plantilla por defecto y reglas de ejemplo),
  `theme.ts` (paleta cerrada con contraste AA comprobado por test) y
  `assets.ts` (URL pública y ruta de subida).
- Renderer: `components/landing/landing-page.tsx`, compartido por `/` y la vista
  previa.
- Editor: `components/admin/landing-editor.tsx`.
- **Para añadir un tipo de sección:**
  1. su esquema en `schema.ts` y su entrada en `SECTION_TYPES` y `SECTION_LABELS`;
  2. el caso en `createSection`;
  3. el componente en el renderer;
  4. el formulario en `SectionForm`;
  5. el test en `tests/landing.test.ts`.
- La base de datos solo valida la forma general del JSON
  (`private.landing_content_is_valid`).
- **Markdown:** `components/markdown/safe-markdown.tsx` (sin HTML crudo, sin
  imágenes y con enlaces filtrados por `safeMarkdownUrl`).

### Estilos, avatares, tests y migraciones

- **Sistema visual:**
  - Fuentes: `font-display` (Pixelify Sans) solo para títulos; Inter en el cuerpo.
  - Utilidades en `app/globals.css`: `pixel-frame`, `pixel-frame-sm`,
    `pixel-button`, `pixel-grid` y `pixelated`. El color del borde sale de
    `--frame`.
  - Variables del tema: `--accent`, `--accent-strong`, `--accent-soft` y
    `--accent-contrast`.
  - El participante ve el estilo pixel; el admin es sobrio (slate/sky).
  - Respeta `prefers-reduced-motion`. Sin emojis.
- **Avatares:** 12 SVG generados por `scripts/generate-avatars.mjs`. Restricción
  SQL `^avatar-(0[1-9]|1[0-2])$`.
- **Tests:** `tests/*.test.ts`.
  - `tests/migrations.test.ts` verifica invariantes estáticas del SQL: RLS en
    toda tabla creada, ningún grant de escritura, RPC admin con `require_role`
    y auditoría, tablas inmutables y bucket sin SVG. Ampliarlo en cada fase.
  - `tests/campaign.test.ts` compara las transiciones de estado de TypeScript con
    las del SQL.
  - Los módulos `.mjs` importados en tests necesitan su `.d.mts`.
- **Migraciones:** `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql`, dentro de
  `begin; ... commit;`, aditivas y nunca editadas una vez aplicadas.
  `private.handle_new_user` se reemplaza con `create or replace` copiando el
  cuerpo **completo** vigente (última versión: `20261021000000`).

## 6. Modelo de datos

**Fases 0 y 1**

- `public.profiles` (RLS: lectura propia): nombre, apellido, alias (único con
  `lower`), nacimiento, `age_declaration`, departamento (enum de 14), avatar,
  `rules_accepted_at`, `privacy_accepted_at` y `profile_completed_at`.
- `private.user_roles`, `private.role_audit_log`, `private.bootstrap_state` y
  `private.blocked_alias_terms`.
- Trigger `private.handle_new_user`: crea el perfil desde la metadata validada,
  asigna el rol `participant` y registra la aceptación de las reglas vigentes.
- RPCs: `get_my_role`, `is_alias_available` (anon), `update_my_profile`,
  `complete_my_profile` y `bootstrap_first_superadmin` (solo service_role).

**Fase 2**

- `public.campaigns`: estado (`campaign_status`), fechas, premio, un solo
  `published` (índice parcial). Lectura con RLS solo para admins.
- `public.landing_pages`: `draft` y `published` en jsonb, más
  `published_version`. `public.landing_page_versions` es inmutable.
- `public.campaign_rules_versions` es inmutable (`is_major`; la v1 siempre lo
  es). `public.rules_acceptances` tiene PK `(user_id, rules_version_id)` y
  lectura propia.
- `private.audit_log`: solo inserción, con triggers que bloquean `UPDATE`,
  `DELETE` y `TRUNCATE`.
- Helpers: `private.require_role`, `private.write_audit`,
  `private.current_campaign_id`, `private.forbid_mutation`,
  `private.landing_content_is_valid` y `public.is_admin`.
- RPCs públicas: `get_public_landing` (nunca expone el borrador),
  `get_current_rules`, `get_my_rules_status` y `accept_current_rules`.
- RPCs admin:
  - `admin_create_campaign` y `admin_update_campaign`;
  - `admin_set_campaign_status`: publicar exige fechas, reglas y portada
    publicadas y que no haya otra campaña publicada;
  - `admin_save_landing_draft`, `admin_publish_landing` y
    `admin_restore_landing_version`;
  - `admin_publish_rules`.

Aún **no existen**: puntos, ranking, estado disciplinario, cuestionarios,
recompensas, moderación ni panel de auditoría.

## 7. Decisiones pendientes del responsable

1. Actividad del sábado 24 (cuestionario, código/QR en vivo o ambos).
2. Si los menores de edad pueden ganar el premio y con qué autorización.
3. Textos legales definitivos con el nombre del organizador y el contacto.
4. Identidad del ranking (alias, nombre o ambos) y criterio de desempate.
5. Si admins y superadmins compiten. Por defecto propuesto: no.

## 8. Riesgos abiertos

- Límite de Resend gratis: 100 correos/día. Un registro masivo el mismo día podría agotarlo.
- Sin Content-Security-Policy ni CAPTCHA en el registro.
- Las imágenes del bucket son públicas por URL; no subir nada privado.
- `npm run dev` local apunta a **producción**: no crear datos ficticios desde
  local.
- Backups: Pro incluye diarios (7 días); PITR es un add-on de pago opcional.

## 9. Comandos

```bash
npm run dev                       # local (usa .env.local → PRODUCCIÓN)
npm run check                     # lint + typecheck + tests + build
node scripts/supabase-mgmt.mjs query "select ..."   # solo lectura
node scripts/supabase-mgmt.mjs auth:get [claves]
node scripts/supabase-mgmt.mjs auth:patch cambios.json
npx supabase db push --dry-run    # SIEMPRE antes de aplicar
npx supabase db push              # solo con autorización explícita
# Desplegar (token desde .env.seed.local, nunca impreso):
VT=$(node -e 'process.loadEnvFile(".env.seed.local");process.stdout.write(process.env.VERCEL_TOKEN)')
npx vercel@latest deploy --prod --yes --scope computecpart --token "$VT"
```

Para probar RPCs como otro usuario sin dejar rastro: dentro de `begin; ...
rollback;`, ejecutar `set local role authenticated;` y
`select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);`.
Nunca llamar así a RPCs que escriban con un usuario real.
