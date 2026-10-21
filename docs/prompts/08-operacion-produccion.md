# PROMPT 8 — Endurecimiento y operación de la campaña

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`.

Producción ya está en uso. Esta fase es una **auditoría de solo lectura** más
documentación operativa. No cambies la configuración remota ni despliegues sin
autorización explícita. Propón los cambios y espera.

## 0. Estado de partida

Producción en https://piensads.app desde el 23/10/2026. Infraestructura y costes en HANDOFF §3: Supabase Pro con
Spend Cap y Vercel Pro con presupuesto de $1 y pausa. Cualquier recomendación que implique coste extra (PITR,
cómputo, add-ons, plan de pago de Resend) debe presentarse con su precio y esperar la decisión del responsable.

## 1. Comprobaciones

**Supabase**

- Plan Pro.
- Backups diarios activos; valorar PITR para la semana del cierre.
- Migraciones de `supabase/migrations` iguales a las remotas
  (`supabase migration list`).
- RLS y grants (consulta de solo lectura).
- SMTP con dominio autenticado; plantillas OTP en español.
- Redirect URLs solo del dominio real y de localhost.
- `site_url` correcto.
- Límites de Auth adecuados.
- Buckets de Storage con políticas correctas.
- Token de la Management API vigente y rotado.

**Vercel**

- Variables solo en Production; la secret key no existe en Vercel.
- Dominio con HTTPS y redirección `www`.
- Previews protegidas y sin acceso a producción.
- Límites de gasto activos.
- Logs accesibles.

**Aplicación**

- Sin cuentas, contenido ni banners de demo.
- Reglas definitivas publicadas y versionadas; privacidad revisada por el
  organizador.
- Fechas, premio, configuración del ranking y criterio de desempate publicados.
- Decisión sobre menores y premio aplicada.

**Seguridad**

- Roles, RLS, canjes y duplicados.
- Timestamps del servidor.
- Rate limiting (Auth y canjes).
- Cobertura de la auditoría.
- Exportaciones restringidas.
- CSP y cabeceras.
- Superadmins con MFA.

## 2. Manual de operación (`README_PRODUCTION.md`)

Procedimientos paso a paso para:

- Publicar un cuestionario y una recompensa en vivo.
- Revisar respuestas abiertas.
- Corregir puntos con un movimiento compensatorio.
- Suspender o descalificar a un participante.
- Añadir un admin.
- Revertir un despliegue en Vercel (Instant Rollback).
- Responder a un incidente: correo caído, abuso de registro o un código QR
  filtrado (desactivar y regenerar).
- **Cierre de campaña:** pasar a `closed` y luego `finalized`, exportar el
  ranking final y la auditoría, verificar la identidad del ganador y aplicar la
  retención o anonimización según `/privacidad`.

## 3. Entrega

- Qué está listo.
- Qué falta.
- Qué debe configurar el responsable manualmente.
- Riesgos abiertos, por severidad.
- Orden recomendado de las acciones pendientes.

**DETENTE.**
