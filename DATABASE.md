# Base de datos

PostgreSQL 17 en Supabase. Migraciones en `supabase/migrations/` (aditivas, nunca editadas tras aplicarse).
Los invariantes se comprueban en `tests/*.test.ts` sobre el SQL.

## Diagrama

```mermaid
erDiagram
  auth_users ||--|| profiles : "1:1"
  auth_users ||--|| user_roles : "private"
  auth_users ||--o| participant_states : "private"
  campaigns ||--|| landing_pages : ""
  campaigns ||--o{ landing_page_versions : "inmutable"
  campaigns ||--o{ campaign_rules_versions : "inmutable"
  campaign_rules_versions ||--o{ rules_acceptances : ""
  campaigns ||--o{ point_events : "ledger"
  campaigns ||--o{ quizzes : ""
  quizzes ||--o{ quiz_questions : ""
  quiz_questions ||--o{ quiz_options : ""
  quiz_questions ||--|| quiz_answer_keys : "private"
  quizzes ||--o{ quiz_attempts : "1 por usuario"
  quiz_attempts ||--o{ quiz_answers : ""
  campaigns ||--o{ rewards : "misiones"
  rewards ||--|| reward_codes : "private"
  rewards ||--o{ reward_redemptions : "1 por usuario"
  campaigns ||--o{ raffle_draws : "private, inmutable"
```

## Tablas

| Tabla | Propósito | Invariantes |
| --- | --- | --- |
| `public.profiles` | Datos del participante, `passport_code`, teléfono, consentimientos | Alias único (case-insensitive) y filtrado; datos históricos del alta inmutables |
| `private.user_roles` | Rol (`participant`/`admin`/`superadmin`) | Nunca desde metadata; ≥ 1 superadmin |
| `private.participant_states` | `active`/`suspended`/`disqualified`/`archived` | Solo `active` gana puntos |
| `public.campaigns` | Campaña, fechas, premio, configuración del ranking | Una sola `published` |
| `public.landing_pages` / `_versions` | Portada borrador/publicada e historial | Historial inmutable |
| `public.campaign_rules_versions` / `rules_acceptances` | Reglas versionadas y aceptaciones | Versiones inmutables |
| `public.point_events` | **Ledger de puntos** | Solo inserción; único por (campaña, usuario, tipo, origen); reversión única |
| `public.quizzes`, `quiz_questions`, `quiz_options` | Trivias | Bloqueo por trigger tras el primer intento |
| `private.quiz_answer_keys` | Respuesta correcta y explicación | Nunca expuesta antes del cierre |
| `public.quiz_attempts` / `quiz_answers` | Intentos y respuestas | `unique(quiz_id, user_id)`; plazo del servidor |
| `public.rewards` / `private.reward_codes` | Misiones y su código | Código privado, regenerable |
| `public.reward_redemptions` | Canjes | `unique(user_id, reward_id)` (código = QR) |
| `private.redeem_attempts` | Intentos de canje | Límite 10 fallos / 10 min |
| `private.campaign_members` | Miembros de campañas privadas | Se entra con el enlace de invitación |
| `private.private_only_accounts` | Cuentas creadas desde una invitación | Fuera de la campaña principal hasta unirse |
| `private.audit_log` | Auditoría | Solo inserción |
| `private.raffle_draws` | Sorteos | Inmutable; semilla + huella de la lista |

## Varias campañas

`public.campaigns` admite una sola campaña **pública** publicada (índice `campaigns_single_published_public`) y cualquier
número de campañas **privadas** (`is_private`, `invite_token`, `invite_enabled`).

- `private.primary_campaign_id()`: la campaña pública vigente.
- `private.requested_campaign_id()`: la campaña pedida en la cabecera `x-campaign`, solo si quien llama es miembro o staff.
- `private.current_campaign_id()`: la pedida o, si no, la principal. Todas las RPC de campaña la usan.
- `private.user_in_campaign(usuario, campaña)`: pertenencia. Filtra ranking, rifa y directorio, y el trigger
  `enforce_campaign_participation` la exige al escribir puntos, intentos y canjes.
- **RPC:** `get_campaign_invite`, `get_my_campaigns`, `join_campaign`, `join_primary_campaign`,
  `admin_set_campaign_private`, `admin_regenerate_campaign_invite`, `admin_set_campaign_invite`,
  `admin_campaign_member_count`.

## Funciones clave

- **Internas:** `require_role`, `write_audit`, `current_campaign_id`, `award_points`, `campaign_standings`,
  `finalize_attempt`, `speed_bonus`, `new_reward_code`, `raffle_eligible`.
- **Participante:** `get_my_points`, `list_my_quizzes`, `start_quiz_attempt`, `save_quiz_answer`,
  `submit_quiz_attempt`, `get_quiz_result`, `preview_reward`, `redeem_reward`, `update_my_profile`,
  `update_my_contact`, `accept_current_rules`.
- **Públicas (anon):** ver `SECURITY.md`.
- **Admin (`admin_*`):** todas empiezan con `require_role` y las que mutan escriben `write_audit`.

## Ranking

`private.campaign_standings`: puntos = suma del ledger; desempate por aciertos y luego eventos completados (regla 7),
excluyendo estadísticas de movimientos revertidos. `RANK()` deja empates con la misma posición. Compiten solo
participantes `active`/`suspended` con perfil completo.
