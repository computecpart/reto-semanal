# PROMPT 1b — Cierre de producción: SMTP con Resend y push a GitHub

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` (§3, §4 y §9) y `docs/prompts/README.md`.

Vercel, el dominio `piensads.app` y Supabase ya están configurados. Esta fase
cierra lo único que bloquea a los usuarios reales: **el correo** (y el push).
No añadas funcionalidades.

## 1. Resend + dominio

Comprueba, sin imprimirla, que `RESEND_API_KEY` en `.env.seed.local` empieza por
`re_`. Si está vacía, pide al responsable que la pegue **en el archivo** y lo
guarde (Ctrl+S); nunca en el chat.

Con la API de Resend (`https://api.resend.com`):

1. `POST /domains` con `{ name: "piensads.app", region: "us-east-1" }`, o
   reutiliza el dominio si ya existe (`GET /domains`).
2. Crea cada registro DNS que devuelva (SPF/MX en `send`, DKIM en
   `resend._domainkey`) en **Vercel DNS**: `POST
   https://api.vercel.com/v2/domains/piensads.app/records?teamId=team_GtixyaLKYtbs1Q4lpZM5IzIi`
   con `VERCEL_TOKEN`. Añade también DMARC: TXT `_dmarc` = `v=DMARC1; p=none;`.
3. `POST /domains/{id}/verify` y consulta el estado hasta `verified` (puede
   tardar minutos).
4. Crea una API key **solo de envío** para ese dominio (`POST /api-keys` con
   `permission: "sending_access"` y `domain_id`). Guárdala como
   `RESEND_SMTP_KEY` en `.env.seed.local`, sin imprimirla.

## 2. SMTP en Supabase

Con `node scripts/supabase-mgmt.mjs auth:patch` (JSON temporal fuera del repo y
borrado al terminar):

- `smtp_admin_email: "no-reply@piensads.app"`, `smtp_sender_name: "Reto Semanal"`.
- `smtp_host: "smtp.resend.com"`, `smtp_port: "465"`, `smtp_user: "resend"` y
  `smtp_pass` = `RESEND_SMTP_KEY`.
- `rate_limit_email_sent: 100` (por hora; el plan gratis de Resend permite 100
  correos al día. Si la apertura lo supera, el responsable decide si sube de
  plan).

Verifica con `auth:get` que las plantillas en español siguen aplicadas.

## 3. Prueba real

Pide al responsable que se registre en https://piensads.app/registro con un
correo que **no** sea miembro del proyecto de Supabase, y que confirme:

1. Llega el correo «Tu código de verificación – Reto Semanal» desde
   `no-reply@piensads.app`, con 6 dígitos.
2. El código verifica y lleva a `/app/perfil`.
3. «Olvidé mi contraseña» envía el enlace y permite cambiarla en el mismo
   navegador.
4. Revisa la carpeta de spam y, si aparece ahí, comprueba SPF, DKIM y DMARC.

## 4. Push a GitHub

Solo con autorización explícita: `git push -u origin main`. Si el sistema de
permisos lo bloquea, entrega el comando al responsable. Opcional: conectar la
integración Git de Vercel (rama `main` = Production) y desactivar los despliegues
de Preview o dejarlos sin variables de Supabase.

## 5. Cierre

Actualiza `docs/HANDOFF.md` §3 y §4, recuerda al responsable revocar los tokens
expuestos y entrega el resumen. **DETENTE.**
