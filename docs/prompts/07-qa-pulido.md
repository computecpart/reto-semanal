# PROMPT 7 — QA, pulido y documentación

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`. Producción está viva.

Fase de integración y calidad. **No añadas funcionalidades grandes.**

## 0. Estado de partida

- Sistema visual pixel ya definido (HANDOFF §5): revísalo pantalla por pantalla, no lo reinventes.
- La portada ya es un constructor por secciones. Verifica cada tipo de sección con y sin imagen, con tema claro y
  oscuro, a 360 px.
- Las tablas inmutables y las RPC admin ya tienen invariantes en `tests/migrations.test.ts`. Amplíalas, no las
  dupliques.

## 1. Seed de demostración (solo local)

- `npm run seed:demo`. Se niega a ejecutarse si la URL no es local: reutiliza
  `scripts/lib/supabase-target.mjs` exigiendo `SUPABASE_ENVIRONMENT=local` y un
  host `127.0.0.1` o `localhost`.
- Datos:
  - 1 superadmin, 1 admin y ~10 participantes;
  - una campaña con ranking coherente;
  - cuestionarios cerrado, activo y futuro, con multiple choice y open text y
    una revisión pendiente;
  - recompensas vigente, futura y vencida;
  - un participante suspendido y uno descalificado.
- Las credenciales generadas van en `.env.demo.local` (ignorado por git) y
  nunca se imprimen.
- Las cuentas se crean por el Auth Admin API local con la metadata de registro
  completa (el trigger rechaza altas sin ella).

## 2. Revisión de UI

- Pixel-art profesional en participante y admin sobrio. Sin emojis ni aspecto
  de plantilla.
- Verificar en 360, 390, 768, 1024 y 1440 px. Sin scroll horizontal.
- Estados de carga, vacío, error, éxito y deshabilitado en todas las pantallas
  importantes (`loading.tsx`, `error.tsx` y `not-found.tsx` por segmento).

## 3. Accesibilidad

Labels, orden de teclado, foco visible, `aria-live` en mensajes, contraste AA,
`prefers-reduced-motion` y textos alternativos de los avatares.

## 4. Auditoría de seguridad

- **RLS y grants** de todas las tablas, mediante una consulta a `pg_class`,
  `pg_policies` y `information_schema.role_table_grants` en producción con
  `scripts/supabase-mgmt.mjs query`, solo lectura.
- **Secretos:** ninguno en el bundle cliente. Revisa `.next/static` en busca de
  `sb_secret_` o `service_role`.
- Roles y jerarquía; que las respuestas correctas no salgan antes del cierre;
  puntos solo por `award_points`; códigos y canjes; concurrencia; timestamps
  del servidor.
- Añade una Content-Security-Policy compatible con Next 16, con nonces si hace
  falta. Lee la guía en `node_modules/next/dist/docs/`.

## 5. Tests mínimos (unitarios, integración local o E2E)

Auth, roles, quiz, timer y plazo, preguntas abiertas, scoring, doble submit,
ledger, privacidad del ranking, canje duplicado manual/QR, recompensa vencida y
futura, moderación, restricciones de admin, superadmin y auditoría. Lo que
requiera base de datos se ejecuta contra Supabase local; si no hay Docker,
márcalo NOT RUN, nunca contra producción.

## 6. Documentación

Crea o actualiza:

- `README.md`;
- `README_DEMO.md` (entorno local con `supabase start` y el seed);
- `README_PRODUCTION.md` (operación diaria y despliegue);
- `SECURITY.md`;
- `DATABASE.md` (tablas, RPCs, invariantes y diagrama);
- `AGENTS.md`;
- `docs/HANDOFF.md`.

## Entrega

`npm run check` sin ignorar errores y una lista PASS/FAIL/NOT RUN por cada
punto. **DETENTE.**
