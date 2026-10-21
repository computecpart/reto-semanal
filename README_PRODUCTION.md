# Operación en producción — MSI Passport (piensads.app)

Manual para el equipo organizador y para quien mantenga la plataforma. Producción es el **único**
entorno con datos reales: https://piensads.app (Vercel) + Supabase `reto-semanal-prod`.

## Operación diaria (consola `/admin`)

| Tarea | Dónde | Notas |
| --- | --- | --- |
| Publicar una trivia | Cuestionarios → Nuevo → Programar | Se activa sola entre apertura y cierre. Con el primer intento se bloquean las preguntas: para cambiarlas, **Duplicar**. |
| Revisar respuestas abiertas | Revisiones | Aprobar, parcial o rechazar. Mientras haya pendientes, el ranking se muestra como provisional. Hacerlo **antes del cierre de la campaña** (11/12). |
| Misión presencial | Misiones → Nueva misión | Mostrar el QR o dictar el código solo a quien completó la actividad. **Presentar** abre la pantalla completa para proyectar. |
| Código filtrado | Misiones → la misión → Regenerar código | El código y el QR anteriores dejan de funcionar al instante. |
| Corregir puntos | Ranking y puntos → Ajuste manual o Revertir | Nunca se edita un movimiento: se crea uno compensatorio con motivo. |
| Suspender o descalificar | Participantes → Cambiar estado | Motivo obligatorio (no lo ve el participante). Un admin solo actúa sobre participantes. |
| Alias inapropiado | Alias | Añade el término y revisa los alias en conflicto; pide el cambio a la persona. |
| Añadir un admin | Administradores (solo superadmin) | Por correo de una cuenta ya registrada. Los admins no compiten. |
| Revisar cambios | Auditoría | Solo lectura, con antes/después. |
| Editar portada | Campañas → la campaña → Portada | Se autoguarda el borrador; **Publicar** para que se vea. |

## Cierre de campaña (11/12/2026)

1. Cerrar la última trivia y terminar **todas** las revisiones abiertas antes de la hora de cierre.
2. Campaña → Datos y estado → **Cerrada** (bloquea nuevas puntuaciones). Revisar incidencias en Auditoría.
3. Exportar el ranking (Ranking y puntos) y los participantes (Participantes → Exportar CSV, solo superadmin).
4. **Rifa** (solo superadmin): publicar la lista de elegibles y su huella; sortear en vivo con una semilla pública;
   publicar el resultado. Ver `docs/campaign/rifa-verificable.md`.
5. Verificar la identidad del ganador por el teléfono y el correo registrados. Pasar la campaña a **Finalizada**.
6. Retención: conservar los datos solo el tiempo indicado en `/privacidad`; después, eliminar o anonimizar.

## Despliegue

```bash
npm run check                                   # lint, typecheck, tests, build
npx supabase db push --dry-run                  # revisar migraciones pendientes
npx supabase db push                            # aplicar (aditivas; nunca editar una aplicada)
VT=$(node -e 'process.loadEnvFile(".env.seed.local");process.stdout.write(process.env.VERCEL_TOKEN)')
npx vercel@latest deploy --prod --yes --scope computecpart --token "$VT"
git push                                        # cuenta GitHub computecpart
```

Si un cambio de código depende de una migración nueva, aplicar la migración y desplegar **en el mismo paso**.

**Revertir un despliegue:** en Vercel → Deployments → el despliegue anterior → *Promote to Production*
(Instant Rollback). Las migraciones no se revierten: corregir con una migración nueva.

## Incidentes

| Síntoma | Acción |
| --- | --- |
| No llegan los correos | Resend (plan gratis: 100/día). Revisar el panel de Resend; si se agotó, subir de plan o esperar. |
| Abuso en el registro | Activar CAPTCHA en Supabase Auth (Turnstile/hCaptcha) y revisar Participantes. |
| QR o código filtrado | Regenerar el código de la misión; revisar los canjes de esa misión en su página. |
| Puntos incorrectos | Revertir el movimiento con motivo y, si corresponde, crear el ajuste correcto. |
| Error en una sección | La página muestra «Reintentar». El código que muestra el admin se busca en los logs de Vercel. |

## Costes

Supabase Pro (~$25/mes, Spend Cap activo) y Vercel Pro ($20/mes, presupuesto on-demand de $1 con pausa). No
activar add-ons (PITR, cómputo mayor, dominio personalizado de Supabase) sin decidir el coste.

## Credenciales

En `.env.seed.local` (fuera de git): tokens de Supabase y Vercel (caducan ~28/10/2026: renovarlos), claves de
Resend. Nunca pegarlas en un chat ni en un ticket.
