# Seguridad

## Modelo

- **Autoridad en PostgreSQL.** La interfaz nunca decide puntos, roles, plazos ni elegibilidad. Toda escritura pasa
  por funciones `security definer` con `search_path = ''`; los clientes solo tienen `SELECT` (y RLS) y nunca
  `INSERT/UPDATE/DELETE`.
- **RLS en todas las tablas** (24 a la fecha de la auditoría). Las tablas sensibles viven en el esquema `private`, que la
  Data API no expone: roles, claves de respuestas, códigos de misión, estados disciplinarios, auditoría y sorteos.
- **Roles** en `private.user_roles`, nunca en `user_metadata`. Registro público = siempre `participant`.
  Jerarquía: un admin solo actúa sobre participantes; solo un superadmin gestiona roles; siempre queda ≥ 1 superadmin.
- **Puntos** solo mediante `private.award_points` (fuente de verdad: `public.point_events`, solo inserción,
  idempotente por origen) o ajustes/reversiones auditados. Las correcciones son movimientos compensatorios.
- **Tiempos** del servidor (`statement_timestamp()`). El temporizador del navegador es solo visual.
- **Trivias**: las respuestas correctas y explicaciones están en `private.quiz_answer_keys` y solo se revelan tras el
  cierre; un intento por persona; envío idempotente.
- **Misiones**: códigos de 8 símbolos sin ambigüedades generados con `gen_random_bytes` (muestreo por rechazo), un
  canje por persona y misión (código o QR), límite de 10 fallos / 10 min, y un enlace de QR nunca canjea por sí solo.
- **Auditoría** `private.audit_log` de solo inserción (triggers bloquean UPDATE/DELETE/TRUNCATE).

## Superficie pública

Funciones ejecutables sin sesión: `get_public_landing`, `get_current_rules`, `get_public_quizzes`, `get_ranking`,
`get_ranking_settings`, `get_disqualified_participants`, `is_alias_available`. Todas son de lectura y no exponen
correo, teléfono, fecha de nacimiento, edad ni departamento (el ranking muestra alias e identificador parcial).

## Cabeceras

CSP (sin nonces, según la guía de Next 16: `script-src 'self' 'unsafe-inline'`), `frame-ancestors 'none'`,
`object-src 'none'`, `connect-src`/`img-src` limitados a Supabase, HSTS, `nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy` estricta y `Permissions-Policy` (cámara solo propia, para el escáner).

## Secretos

- La secret key de Supabase **nunca** está en Vercel ni en el código del navegador (comprobado escaneando
  `.next/static`). Solo se usa en scripts administrativos locales.
- Variables `NEXT_PUBLIC_*` con nombres de secreto están bloqueadas por `scripts/check-public-env.mjs`.
- Exportaciones CSV: participantes solo superadmin (auditada); protegidas contra inyección de fórmulas.

## Riesgos conocidos

- CSP con `'unsafe-inline'` en scripts (mitigado por React y Markdown sin HTML).
- Sin CAPTCHA en el registro; sin MFA obligatorio para administradores.
- Resend gratis: 100 correos/día.

## Reportar un problema

Escribir a soporte@digitalsolutions.com.sv sin incluir datos personales ni contraseñas.
