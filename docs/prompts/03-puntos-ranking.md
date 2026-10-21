# PROMPT 3 — Ledger de puntos, estado del participante y ranking

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`. Producción está viva.

Implementa **exclusivamente** la economía de puntos, el estado del participante
y la clasificación. Sin cuestionarios ni QR. Esta fase crea la infraestructura
que usarán las Fases 4 y 5.

## 1. Estado del participante (mínimo)

- `private.participant_states`: `user_id` (PK), `status` (`active`,
  `suspended`, `disqualified`, `archived`), `changed_at`, `changed_by` y
  `reason`. Rellena `active` para todos los usuarios existentes y crea la fila
  al registrarse (amplía el trigger de alta con `create or replace`).
- Helper `private.participant_can_earn(user_id)`: solo `active` puede ganar
  puntos.
- Helper `private.is_competitor(user_id)`: rol `participant`. **Admins y
  superadmins no compiten** ni aparecen en el ranking. Confirma esta decisión
  con el responsable.
- La interfaz de moderación es de la Fase 6. Aquí basta el modelo y su uso.

## 2. Ledger `point_events` (fuente única de verdad)

- `public.point_events` con:
  - `id bigint identity`, `campaign_id`, `user_id`;
  - `amount int` (distinto de 0, con un límite razonable en valor absoluto);
  - `kind` (`quiz`, `quiz_speed_bonus`, `open_review`, `reward`, `adjustment`,
    `correction`), `source_type`, `source_id`;
  - `description` (visible para el participante), `reason` (interna);
  - `actor_id`, `reverses_event_id` (referencia a `point_events`);
  - `created_at default now()`.
- **Solo inserción:** un trigger rechaza `UPDATE` y `DELETE` para todos los
  roles.
- **Idempotencia:** índice único parcial
  `(campaign_id, user_id, kind, source_type, source_id)` cuando `source_id` no es
  nulo. Así un cuestionario o una recompensa nunca puntúan dos veces, aunque
  lleguen dos requests simultáneas.
- `private.award_points(...)`: función interna que valida que la campaña esté
  publicada y que el participante pueda ganar puntos, e inserta con
  `on conflict do nothing`, devolviendo si insertó. Sin `execute` para clientes.
  Las Fases 4 y 5 la llaman dentro de su transacción.
- Los clientes nunca reciben `INSERT`, `UPDATE` ni `DELETE`. Lectura con RLS
  limitada a los eventos propios. No existe ningún `total_points` editable.

## 3. Ajustes administrativos

- RPC `admin_adjust_points(user_id, campaign_id, amount, reason)`: motivo
  obligatorio (≥ 10 caracteres), `require_role(admin, superadmin)`, auditoría en
  la misma transacción.
- RPC `admin_reverse_point_event(event_id, reason)`: crea un evento
  `correction` con el importe opuesto y `reverses_event_id`. Un evento solo se
  puede revertir una vez (índice único). Nunca se borra nada.

## 4. Participante

- `/app/puntos`: total, movimientos (fecha en la zona operativa, descripción e
  importe con signo) y estado vacío claro.
- `/app/ranking`: posición, avatar, identidad según la configuración y puntos.
  Resalta al usuario actual y muestra su posición aunque esté fuera del top
  visible.

## 5. Ranking

- RPC `get_ranking(campaign_id)` (`security definer`): calcula desde
  `point_events` y devuelve **solo** `position`, `avatar_id`, `display_alias`,
  `display_name`, `points` e `is_current_user`. Nunca correo, fecha de
  nacimiento, edad ni departamento.
- **Empates:** usa `RANK()` (1, 1, 3), sin desempatar automáticamente. Muestra
  «Empate» en la interfaz. El criterio oficial de desempate lo publica el
  organizador en las reglas.
- Excluye a quienes no compiten. Los `disqualified` quedan fuera (la Fase 6
  añadirá la sección opcional). Los `suspended` siguen apareciendo, pero no
  ganan puntos.
- **Configuración por campaña** (columnas nuevas o tabla de ajustes):
  `ranking_visible`, audiencia (`public`, `authenticated`, `hidden`) e identidad
  (`alias`, `name`, `alias_name`). El RPC aplica la audiencia en servidor: si es
  `authenticated` y no hay sesión, no devuelve filas.
- `is_ranking_provisional(campaign_id)`: por ahora devuelve `false`; la Fase 4
  lo ampliará con las revisiones pendientes. Con `true`, la interfaz muestra
  «Clasificación provisional».
- `/admin/ranking`: configuración y vista previa. Toda mutación queda auditada.
- **Portada:** muestra un top 10 solo si la audiencia es `public` y el ranking
  está visible.

## 6. Pruebas

- Invariantes SQL:
  - `point_events` sin grants de escritura y con trigger de solo inserción;
  - índice de idempotencia;
  - `get_ranking` no selecciona columnas privadas.
- Unitarias: formateo, empates y la identidad mostrada según la configuración.
- **Integración** (recomendada): Supabase local con `supabase start` (Docker)
  para comprobar que el ranking coincide exactamente con
  `sum(point_events)`, la idempotencia con llamadas paralelas y que un
  participant no puede insertar eventos. Nunca contra producción. Si Docker no
  está disponible, márcalo como NOT RUN.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
