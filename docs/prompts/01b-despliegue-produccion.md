# PROMPT 1b — Cerrar despliegue, dominio y SMTP

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` (en especial §3 y §8) y `docs/prompts/README.md`.

Esta fase **no añade funcionalidades**. Su objetivo es dejar las Fases 0 y 1
funcionando en el dominio definitivo para usuarios reales. Comprueba primero qué
quedó hecho en §8 del handoff y completa **solo lo que falte**.

## 1. Vercel (Pro)

- Usa `VERCEL_TOKEN` de `.env.seed.local` con la CLI (`npx vercel ... --token`),
  sin imprimirlo.
- Proyecto `reto-semanal`, framework Next.js, Node 24, región de funciones
  `iad1` (misma zona que Supabase `us-east-1`).
- Variables **solo de Production**: `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nunca la secret key. Las Preview no
  deben apuntar a la base de producción: sin variables de Supabase en Preview y
  con Deployment Protection activada.
- Pide al responsable que active los **límites de gasto** (Spend Management)
  en Vercel.
- Despliega a producción **solo con autorización**.

## 2. Dominio

- Añade el dominio al proyecto de Vercel, verifica el DNS y comprueba que HTTPS
  funcione. Redirige `www` al dominio principal (o al revés, de forma coherente).
- En Supabase (`scripts/supabase-mgmt.mjs auth:patch`): `site_url` =
  `https://<dominio>` y `uri_allow_list` con
  `https://<dominio>/auth/callback`, `https://<dominio>/auth/confirm` y las de
  `localhost` para desarrollo.

## 3. SMTP (bloqueante)

- Proveedor con dominio autenticado (SPF, DKIM, DMARC). Recomendado: Resend
  (integración nativa de Supabase) o Brevo. Calcula el volumen del día de
  apertura (registros + reenvíos + recuperaciones) frente al límite diario del
  plan elegido.
- Remitente `no-reply@<dominio>`, nombre `Reto Semanal`.
- Si el DNS del dominio está en Vercel, crea los registros por la API de Vercel.
- Credenciales SMTP solo en `.env.seed.local`; aplícalas por la Management API.
- Sube `rate_limit_email_sent` (p. ej. 200/h).
- Verifica que las plantillas en español sigan aplicadas (`auth:get`).

## 4. GitHub

- `origin` = `computecpart/reto-semanal`. Primer push **solo con
  autorización**. Opcional: conectar la integración Git de Vercel (Production =
  `main`).

## 5. Prueba de humo en el dominio real

Con el responsable, usando un correo que no sea del equipo:

1. Registro → código OTP por correo → `/app/perfil`.
2. Cerrar sesión → login → editar perfil.
3. Recuperar contraseña desde otro dispositivo del mismo usuario (el enlace
   debe abrirse en el mismo navegador que lo pidió).
4. `/admin` como participant → rechazado; como superadmin → permitido.
5. Revisar las cabeceras de seguridad y HTTPS.

Actualiza `docs/HANDOFF.md` §3 y §8, entrega el resumen y **DETENTE**.
