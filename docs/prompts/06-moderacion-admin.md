# PROMPT 6 — Moderación, administradores y panel de auditoría

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`. Producción está viva.
Reutiliza `private.participant_states` (Fase 3) y `private.audit_log` (Fase 2, ya existe).

Implementa **exclusivamente** las herramientas administrativas restantes.

## 0. Integración con lo existente

- `private.participant_states` (Fase 3) ya existe: aquí se añade su gestión.
- `private.audit_log` (Fase 2) ya registra todo: aquí se añade el panel de consulta. Los registros de
  `private.role_audit_log` (bootstrap) también deben verse.
- `private.blocked_alias_terms` (Fase 1) es la lista de alias prohibidos. `private.alias_is_allowed` ya la consulta.
- Añade «Participantes», «Administradores» (solo superadmin) y «Auditoría» en `components/admin/admin-nav.tsx`.
  Oculta los enlaces que el rol no puede usar, aunque la autoridad siga en el RPC.
- `lib/permissions/users.ts` (`canManageTarget`, `canManageAdministrativeRoles`) refleja la jerarquía en
  TypeScript. Mantenlo sincronizado con el SQL mediante un test, como `tests/campaign.test.ts` hace con las
  transiciones.

## 1. Participantes (`/admin/participantes`)

- RPC `admin_list_participants(filtros, página)` (`security definer`, solo
  admin y superadmin) que une `auth.users` y los perfiles. Devuelve:
  - avatar, nombre, apellido, alias y correo;
  - departamento, edad calculada con la fecha operativa y mayor/menor;
  - puntos de la campaña actual (desde el ledger), estado, rol y fecha de
    registro.
- Búsqueda por alias, nombre o correo. Filtros por estado, departamento,
  mayor/menor y rol. Paginación en servidor.
- Exportación CSV (solo superadmin), auditada.

## 2. Estados y moderación

- RPC `admin_set_participant_status(user_id, status, reason)`:
  - `suspended`: temporal; no gana puntos ni inicia actividades, pero conserva
    su historial.
  - `disqualified`: queda excluido de la competencia.
  - `archived`: administrativo.
  - Vuelta a `active` permitida, también con motivo.
- El motivo es obligatorio (≥ 10 caracteres) y se guarda con actor, acción,
  participante y fecha en la auditoría.
- **Jerarquía:** un admin solo actúa sobre `participant`. Nunca sobre otro admin
  ni sobre un superadmin. Valídalo en el RPC, no solo en la interfaz.
- Nunca se borra físicamente a un usuario con historial durante la campaña.
- Un usuario suspendido o descalificado ve un aviso claro en `/app`, sin el
  motivo detallado.

## 3. Ranking y descalificados

- Ajuste «Mostrar participantes descalificados» (por campaña, desactivado por
  defecto). Si está activo, aparecen en una sección separada, sin posición y
  **sin el motivo**.

## 4. Moderación de alias

- Interfaz sobre `private.blocked_alias_terms` mediante RPC: añadir y
  desactivar términos (categoría `reserved` u `offensive`), con auditoría.
- El filtro de TypeScript (`lib/validation/profile.ts`) es solo una primera
  barrera de UX; la autoridad es PostgreSQL.
- Ofrece una vista de alias existentes que coinciden con términos nuevos, para
  revisión manual. Nunca renombrar de forma automática.

## 5. Administradores (`/admin/administradores`, solo superadmin)

- Promover `participant` a `admin`, quitar admin (vuelve a `participant`) y
  promover o degradar superadmins.
- Todo con `require_role(superadmin)` en el RPC y auditoría (además de
  `private.role_audit_log`).
- **Siempre debe quedar al menos un superadmin activo:** bloquea las filas de
  superadmins (`for update`) y cuenta dentro de la misma transacción antes de
  degradar.
- Un superadmin no puede degradarse a sí mismo si es el último.
- Recomendado: exigir MFA (TOTP de Supabase, ya habilitado en el proyecto) para
  roles administrativos. Al menos, ofrecer la inscripción y avisar si falta.

## 6. Auditoría (`/admin/auditoria`)

- Solo lectura: filtros por acción, actor, entidad y rango de fechas, y vista de
  diferencias `before`/`after`.
- Debe cubrir ajustes de puntos, estados, configuración, quizzes, recompensas,
  reglas y administradores.
- No hay ninguna acción de edición o borrado. El trigger de solo inserción ya lo
  impide en la base de datos.

## 7. Pruebas

- Invariantes SQL: todos los RPC admin llaman a `require_role` y escriben
  auditoría; el CSV es solo para superadmin.
- Integración en Supabase local (si hay Docker):
  - admin contra admin o superadmin → rechazado;
  - degradar al último superadmin → rechazado;
  - el descalificado no aparece en el ranking;
  - el suspendido no gana puntos.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
