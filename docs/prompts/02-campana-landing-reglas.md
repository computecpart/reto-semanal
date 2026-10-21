# PROMPT 2 — Campañas, portada, reglas versionadas y sistema visual

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md` (reglas comunes).
Producción está viva: toda migración es aditiva y se aplica solo con autorización.

Implementa **exclusivamente**: campañas, portada pública, reglas versionadas,
auditoría base y el sistema visual. Sin quizzes, puntos, ranking ni QR.

## 1. Auditoría base (la usarán todas las fases)

- `private.audit_log`: `id bigint identity`, `occurred_at timestamptz default
  now()`, `actor_id uuid`, `actor_role app_role`, `action text`, `entity_type
  text`, `entity_id text`, `campaign_id uuid null`, `before jsonb`, `after
  jsonb`, `reason text`.
- Solo inserción: un trigger rechaza `UPDATE` y `DELETE` para cualquier rol.
- Helper interno `private.write_audit(...)`, sin `execute` para clientes.
- Helper `private.require_role(variadic public.app_role[])`, que lanza `42501`
  si el rol de `auth.uid()` no está en la lista. Úsalo en todos los RPC admin.
- Toda RPC administrativa escribe su auditoría **en la misma transacción**.

## 2. Campañas

- Tipo `campaign_status`: `draft`, `published`, `closed`, `finalized`,
  `archived`.
- Transiciones permitidas, validadas en el RPC: `draft→published`,
  `published→closed`, `closed→finalized`, `finalized→archived` y
  `draft→archived`. Cualquier otra se rechaza.
- Tabla `public.campaigns` con:
  - `id`, `slug` (único; minúsculas, números y guiones), `name`, `status`;
  - `headline`, `subtitle`, `description`;
  - `prize_title`, `prize_description`;
  - `starts_at`, `ends_at` (`timestamptz`, con check `ends_at > starts_at`);
  - `how_to_participate` (Markdown), `cta_label`;
  - `branding jsonb`, validado contra una lista blanca de claves y valores, por
    ejemplo un color de acento de una paleta cerrada;
  - `created_at`, `updated_at`, `updated_by`.
- Como máximo una campaña `published` a la vez (índice parcial único). La
  «campaña actual» es la publicada, o la `closed`/`finalized` más reciente si no
  hay publicada.
- Diseña la tabla para soportar varias campañas. Todas las tablas de fases
  futuras (quizzes, puntos, recompensas) llevarán `campaign_id`.
- Lectura pública mediante el RPC `get_public_campaign()` (`anon` y
  `authenticated`), que devuelve solo campos públicos y nunca borradores.
  Escritura solo por RPC admin.
- **No insertes campañas ficticias.** El superadmin crea la campaña real desde
  `/admin/campana`.

## 3. Reglas versionadas

- `public.campaign_rules_versions`: `campaign_id`, `version int`,
  `content_md`, `change_summary`, `is_major boolean`, `published_at`,
  `published_by`. `unique(campaign_id, version)`. Inmutable una vez publicada
  (trigger).
- `public.rules_acceptances`: `user_id`, `rules_version_id`, `accepted_at
  default now()`, con PK compuesta.
- RPC `accept_current_rules()`, idempotente.
- **Registro:** al crearse el usuario, `private.handle_new_user` registra la
  aceptación de la versión vigente de la campaña actual, si existe. Modifícalo
  con `create or replace` en una migración nueva. No toques la lógica de rol.
- **Usuarios existentes y versiones mayores:** si la versión vigente es
  `is_major` y el usuario no la aceptó, el layout de `/app` lo envía a
  `/app/aceptar-reglas` antes de cualquier otra página.
- `/reglas` deja de ser estática: muestra la versión vigente renderizada desde
  Markdown **sin HTML crudo**. Usa `react-markdown` sin `rehype-raw`, con
  versión fijada, y protocolos de enlace restringidos a `https:` y `mailto:`.
  Muestra el número de versión y la fecha. Si no hay campaña, conserva el texto
  actual como respaldo.
- `/privacidad` sigue estática, pero añade la versión vigente y la fecha.

## 4. Portada `/`

Renderizada en servidor desde `get_public_campaign()`. Cada cambio en el admin
llama a `revalidatePath("/")`. Secciones:

- **Hero** configurable, por ejemplo «¿Quieres ganarte una PC?», con CTA
  «Participar ahora» (`/registro`) e «Iniciar sesión». Con sesión iniciada, el
  CTA lleva a `/app`.
- Premio, cómo participar, fechas en `America/El_Salvador` y un enlace a las
  reglas.
- «Próximas actividades» y «Ranking»: espacios **ocultos** hasta que existan las
  Fases 3 y 4. No muestres secciones vacías.
- **Estado sin campaña publicada:** una portada digna con el nombre del
  programa, un mensaje de «Próximamente», login y registro.
- Elimina `components/foundation-status.tsx` si deja de usarse.

## 5. Panel admin

- `/admin`: tablero con accesos a los módulos.
- `/admin/campana`: crear, editar y cambiar el estado de la campaña. Incluye
  editor de reglas con vista previa, publicación de una nueva versión con
  resumen de cambios y marca de «cambio importante», y la configuración del
  branding.
- Cada página llama a `requireAdminPage()`. Admin y superadmin pueden editar la
  campaña. Toda mutación queda auditada con `before` y `after`.

## 6. Sistema visual

- **Participante:** pixel-art premium y moderno; nada infantil y sin emojis.
  - Fuente display pixel solo para títulos, con `next/font`. Por ejemplo
    *Pixelify Sans* o *Silkscreen*; evita fuentes ilegibles en tamaños pequeños.
  - Cuerpo con una sans muy legible (*Inter* o *Geist*).
  - Bordes y sombras escalonadas en CSS, paleta de alto contraste (WCAG AA) y
    tokens de color en Tailwind 4 (`@theme`).
  - Mobile-first desde 360 px; respeta `prefers-reduced-motion`.
- **Admin:** sobrio y operativo; mismos tokens con menos ornamento.
- Aplica el sistema a las pantallas de auth, perfil y legales existentes sin
  cambiar su lógica.

## 7. Pruebas

- Invariantes SQL:
  - RLS en tablas nuevas y sin grants de escritura a clientes;
  - `audit_log` solo inserción;
  - versiones de reglas inmutables;
  - un único `published`;
  - todos los RPC admin llaman a `require_role`.
- Unitarias: transiciones de estado válidas e inválidas, sanitización del
  Markdown (sin `<script>`, `javascript:` ni HTML crudo) y fechas en la zona
  operativa.
- `npm run check` en verde, luego `db push --dry-run` y autorización.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
