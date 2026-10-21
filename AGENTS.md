# Reglas permanentes del proyecto

Estas reglas aplican a todo el repositorio y deben respetarse en cada cambio futuro.

## Seguridad y autoridad

- El navegador nunca determina los puntos.
- Los timestamps críticos vienen del servidor o de la base de datos.
- Nunca desactivar RLS para solucionar un error.
- Un participante (`participant`) nunca puede insertar o modificar puntos directamente.
- Un cuestionario solo puede puntuar una vez por participante.
- Una recompensa QR o código solo puede canjearse una vez por participante.
- Las respuestas correctas nunca deben llegar al cliente antes de corresponder.
- Los roles administrativos nunca pueden depender de `user_metadata`.
- Un `admin` no puede modificar otro `admin` ni un `superadmin`.
- Solo un `superadmin` administra roles administrativos.
- Nunca exponer `SUPABASE_SECRET_KEY`.
- Nunca utilizar una secret key en variables `NEXT_PUBLIC_*`.
- La autorización de la interfaz nunca sustituye la autorización en RLS y RPC.
- Toda tabla expuesta debe tener RLS habilitado antes de ser utilizada.
- Las operaciones críticas deben ser transaccionales e idempotentes y ejecutarse mediante RPC de PostgreSQL.

## Integridad de datos

- No borrar movimientos oficiales de puntos.
- Una corrección crea un movimiento compensatorio.
- Los instantes se almacenan como `timestamptz`; PostgreSQL genera los timestamps críticos.
- La zona horaria operativa es `America/El_Salvador` y se usa para reglas de calendario y presentación, no para reemplazar instantes UTC.

## Operación

- No hacer `git push` sin autorización.
- No desplegar sin autorización.
- No ejecutar SQL destructivo remoto sin autorización.
- No ejecutar migraciones ni seeds remotos sin autorización.
- El proyecto Supabase enlazado (`reto-semanal-prod`, ref `dsrddyibtgfzaafsqhac`) es **PRODUCCIÓN** con usuarios reales. Ver `docs/HANDOFF.md`.
- Demo y producción deben permanecer separadas: ningún seed, dato o cuenta demo se ejecuta contra producción. Las pruebas con datos ficticios usan Supabase local (`supabase start`) o una rama de Supabase.
- Toda migración nueva es aditiva y compatible con los datos existentes; se revisa con `supabase db push --dry-run` antes de aplicarla y solo se aplica con autorización explícita.
- Nunca editar una migración ya aplicada; crear una nueva.
- La configuración remota de Auth se lee y cambia con `scripts/supabase-mgmt.mjs`; nunca SQL de escritura por la Management API.
- La secret key solo puede existir en procesos administrativos aislados; nunca en el runtime web normal.
- `public/avatars/` contiene únicamente recursos estáticos del despliegue, no uploads de usuarios.

## Alcance y verificación

- Conservar lo correctamente implementado y revisar `package.json`, estructura, configuración y seguridad antes de desarrollar.
- Usar App Router, TypeScript estricto, Tailwind CSS, `@supabase/ssr`, Supabase Auth, PostgreSQL y RLS.
- Mantener los roles canónicos: `participant`, `admin` y `superadmin`.
- Validar en este orden: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Revisar `git diff --check` y el estado de Git antes de entregar.
- Pruebas con datos: solo en Supabase local (`npx supabase start`, `npm run seed:demo`, `npm run test:db`); nunca contra producción.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
