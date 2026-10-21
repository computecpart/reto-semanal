# PROMPT 3 — Ledger de puntos, estado del participante y ranking

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md` (reglas comunes).
Producción está viva.

Implementa **exclusivamente** la economía de puntos, el estado del participante
y la clasificación. Sin cuestionarios ni QR. Esta fase crea la infraestructura
que usarán las Fases 4 y 5.

## 1. Estado del participante

- `private.participant_states`: `user_id` (PK, referencia a `auth.users`),
  `status` (`active`, `suspended`, `disqualified`, `archived`), `changed_at`,
  `changed_by` y `reason`.
- En la migración: una fila `active` para todos los usuarios existentes.
- Amplía `private.handle_new_user` con `create or replace`, copiando el cuerpo
  **completo** vigente de `20261021000000`, para que inserte el estado
  `active` al registrarse.
- `private.participant_can_earn(user_id)`: devuelve verdadero solo si el estado
  es `active`.
- `private.is_competitor(user_id)`: solo el rol `participant` compite. **Admins y
  superadmins no compiten ni aparecen en el ranking.** Confirma esta decisión
  con el responsable antes de cerrar la fase.
- RPC `get_my_participant_status()` para que `/app` muestre avisos. La
  interfaz de moderación es de la Fase 6.

## 2. Ledger `public.point_events` (fuente única de verdad)

- Columnas:
  - `id bigint identity`;
  - `campaign_id` (referencia a `campaigns`) y `user_id`;
  - `amount int`: distinto de 0 y `abs(amount) <= 100000`;
  - `kind`: enum `point_event_kind` con `quiz`, `quiz_speed_bonus`,
    `open_review`, `reward`, `adjustment` y `correction`;
  - `source_type text` y `source_id text`;
  - `description text` (visible, ≤ 200) y `reason text` (interna);
  - `actor_id`;
  - `reverses_event_id` (referencia a `point_events`);
  - `created_at default now()`.
- **Solo inserción:** usa el trigger `private.forbid_mutation` (ya existe) para
  `UPDATE` y `DELETE`, y uno de `TRUNCATE`.
- **Idempotencia:**
  - índice único parcial `(campaign_id, user_id, kind, source_type, source_id)`
    cuando `source_id` no es nulo;
  - índice único sobre `reverses_event_id`, porque un evento solo se revierte
    una vez.
- `private.award_points(p_campaign_id, p_user_id, p_amount, p_kind,
  p_source_type, p_source_id, p_description)`:
  - función interna, sin `execute` para clientes;
  - valida que la campaña esté `published` y que se cumplan
    `participant_can_earn` e `is_competitor`;
  - inserta con `on conflict do nothing` y devuelve `boolean` (insertó o no);
  - las Fases 4 y 5 la llaman dentro de su propia transacción.
- RLS: lectura de los eventos propios para `authenticated`. Lectura completa
  para admins con `public.is_admin()`. Sin grants de escritura.

## 3. Ajustes administrativos

- `admin_adjust_points(p_user_id, p_campaign_id, p_amount, p_reason)`:
  - `require_role('admin', 'superadmin')`;
  - motivo obligatorio (≥ 10 caracteres);
  - un admin solo ajusta a `participant`;
  - inserta `kind = adjustment` (sin pasar por `award_points`, para permitir
    negativos y sin `source_id`);
  - `write_audit('points.adjust', ...)`.
- `admin_reverse_point_event(p_event_id, p_reason)`:
  - crea `kind = correction` con el importe opuesto y `reverses_event_id`;
  - el índice impide revertir dos veces;
  - auditoría `points.reverse`.

## 4. Ranking

- Configuración por campaña (migración aditiva en `public.campaigns`):
  - `ranking_visible boolean default false`;
  - `ranking_audience` (`public`, `authenticated` o `hidden`, por defecto
    `authenticated`);
  - `ranking_identity` (`alias`, `name` o `alias_name`, por defecto `alias`).
- RPC `get_ranking(p_limit int default 100)` (`security definer`, `anon` y
  `authenticated`) sobre `private.current_campaign_id()`:
  - aplica la audiencia en servidor: con `hidden`, o `authenticated` sin sesión,
    devuelve 0 filas;
  - devuelve **solo** `position`, `avatar_id`, `display_alias`, `display_name`,
    `points` e `is_current_user`. Nunca correo, nacimiento, edad ni
    departamento;
  - `position = RANK()` sobre `sum(amount)` descendente, de modo que los empates
    comparten posición (1, 1, 3). No desempatar automáticamente;
  - excluye a quienes no compiten y a los `disqualified`. Los `suspended`
    aparecen.
- RPC `get_my_points()`: total y movimientos propios de la campaña actual.
- `is_ranking_provisional()`: devuelve `false` por ahora; la Fase 4 lo amplía.

## 5. Interfaz

- `/app/puntos`: total grande, movimientos (fecha en hora de El Salvador,
  descripción e importe con signo y color) y estado vacío.
- `/app/ranking`: tabla con posición, avatar, identidad y puntos. Resalta tu
  fila y añade un bloque fijo «Tu posición» si estás fuera del top. Muestra
  «Empate» y «Clasificación provisional» cuando corresponda. Estilo pixel del
  participante.
- **Navegación del participante:** añade «Perfil», «Puntos» y «Ranking» en
  `components/app/app-header.tsx`.
- `/admin/ranking`: configuración, vista previa, ajuste de puntos por
  participante (búsqueda por alias) y reversión de un evento. Añade el enlace
  en `components/admin/admin-nav.tsx`.
- **Portada:** nuevo tipo de sección `ranking_preview` (encabezado + top N de 3
  a 10). Sigue los pasos de «Para añadir un tipo de sección» en HANDOFF §5.
  Solo se muestra si `ranking_visible` y la audiencia es `public`.

## 6. Pruebas

- Invariantes SQL:
  - `point_events` con RLS, sin grants de escritura, solo inserción y con el
    índice de idempotencia;
  - `award_points` sin `execute` para clientes;
  - las RPC admin con `require_role` y `write_audit`;
  - `get_ranking` sin columnas privadas.
- Unitarias: formateo, representación de empates, identidad según la
  configuración y signo de los importes.
- **Integración** (recomendada) en Supabase local con `supabase start`, si hay
  Docker:
  - el ranking coincide con `sum(point_events)`;
  - N llamadas paralelas a `award_points` con el mismo origen generan 1 evento;
  - un participant no puede insertar eventos.
  Nunca contra producción. Sin Docker, NOT RUN.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
