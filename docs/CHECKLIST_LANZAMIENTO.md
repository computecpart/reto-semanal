# Checklist de lanzamiento — MSI Passport (auditoría del 22/10/2026)

Auditoría de solo lectura sobre producción (Supabase, Vercel, Resend). Nada se modificó.

## Listo (verificado)

| Área | Estado |
| --- | --- |
| Migraciones | 11 aplicadas, 0 diferencias entre repo y producción; reproducibles desde cero en local |
| RLS y permisos | 24/24 tablas con RLS; clientes solo lectura; anon sin tablas; 7 RPC públicas de lectura |
| Secretos | Ninguno en el bundle; Vercel solo tiene las 2 variables públicas (Production) |
| Auth | Confirmación por OTP de 6 dígitos, contraseña ≥ 8 + HaveIBeenPwned, `site_url` y redirecciones correctas |
| Correo | SMTP propio (Resend), dominio `piensads.app` verificado |
| Dominio | `piensads.app` con HTTPS; `www` → raíz; `*.vercel.app` y previews protegidas |
| Backups | Diarios activos (Supabase Pro). PITR desactivado |
| Cabeceras | CSP, HSTS, `X-Frame-Options`, `nosniff`, cámara solo propia |
| Datos | Sin cuentas ni contenido de demostración; campaña MSI publicada con reglas v2 |
| Funcionalidad | Registro, perfil/pasaporte, trivias, misiones con QR, puntos, ranking, moderación, auditoría y rifa |
| Pruebas | 228 unitarias/estáticas + 5 de integración con concurrencia real (local) |

## Pendiente / decisiones del organizador

1. **Menores de edad**: hoy pueden registrarse y entran en la rifa. Decidir si necesitan autorización o quedan
   excluidos del premio (cambio pequeño en `private.raffle_eligible`).
2. **Teléfono de las 2 cuentas existentes**: agregarlo en Mi pasaporte → Datos de contacto.
3. **Prueba visual en móvil** (360 px) de registro, trivia, canje con cámara y ranking: hacerla el jueves.
4. **MFA** para cuentas administrativas (Supabase lo admite; la app aún no ofrece la inscripción).
5. **CAPTCHA** en el registro: activarlo solo si aparece abuso (Supabase Auth → Turnstile/hCaptcha).

## Configuración manual recomendada

- Vercel → Billing → Spend Management: confirmar «Pause production deployments» **activado** y Observability Plus
  **desactivado**.
- Renovar los tokens de Supabase y Vercel antes del **28/10/2026** y revocar el token de Supabase que se compartió
  en el chat.
- Resend gratis permite **100 correos/día**: si la apertura supera ~70 registros en un día, valorar el plan de pago
  ($20/mes) solo ese mes.

## Riesgos abiertos

| Riesgo | Severidad | Mitigación |
| --- | --- | --- |
| Límite de correos de Resend el día de apertura | Media | Vigilar el panel de Resend; escalonar invitaciones |
| Revisiones abiertas tras el cierre no otorgan puntos | Media | Revisar todo antes del 11/12 23:59 |
| Sin MFA en admins | Media | Contraseñas únicas; pocos admins |
| CSP con `'unsafe-inline'` | Baja | React escapa contenido; Markdown sin HTML |
| PITR desactivado | Baja | Backups diarios (7 días); valorar PITR la semana del cierre |

## Orden recomendado

1. **Jueves 22**: prueba completa en el móvil con una cuenta de participante (registro → trivia de prueba → misión
   con QR → ranking) y con la cuenta superadmin (crear trivia y misión, revisar, auditoría).
2. Decidir sobre menores y completar teléfonos.
3. **Viernes 23 08:00**: la campaña empieza a aceptar puntos sola. Compartir `https://piensads.app`.
4. **Sábado 24**: crear las misiones presenciales en Admin → Misiones y usar «Presentar» en el evento.
5. Semanal: trivias, revisiones y vistazo a Auditoría. Antes del 11/12: cierre y rifa (`README_PRODUCTION.md`).
