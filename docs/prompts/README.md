# Prompts de las fases siguientes

Ejecuta **una fase por sesión**, en este orden, y detente al terminar cada una.
Claude Code carga `CLAUDE.md`, que incluye `AGENTS.md` y `docs/HANDOFF.md`.
Este último contiene el estado real, la infraestructura y las convenciones.

**Fases 0 a 8 completas** y desplegadas en https://piensads.app. Ver docs/CHECKLIST_LANZAMIENTO.md.

| Archivo | Fase | Depende de |
| --- | --- | --- |
| `01b-cierre-produccion.md` | **Completado** (SMTP y push). Solo como referencia | — |
| `03-puntos-ranking.md` | **Completada** (referencia) | 2 |
| `04-cuestionarios.md` | **Completada** (referencia; imagen por cuestionario pendiente) | 3 |
| `05-recompensas-qr.md` | **Completada** como misiones (QR con logo) | 3 |
| `06-moderacion-admin.md` | **Completada** (+ rifa verificable; MFA pendiente) | 3 |
| `07-qa-pulido.md` | **Completada** | 3–6 |
| `08-operacion-produccion.md` | **Completada** (checklist de lanzamiento) | 7 |

Decisiones de diseño respecto al plan original:

- **Los puntos van antes que cuestionarios y recompensas**, porque ambos otorgan
  puntos y necesitan el ledger.
- **La auditoría ya existe** (`private.audit_log` y `private.write_audit`). El
  panel de consulta llega en la Fase 6.
- **El estado del participante** se crea en la Fase 3, porque ranking y canjes
  dependen de él. La interfaz de moderación llega en la Fase 6.
- **El seed demo solo se ejecuta contra Supabase local.**

Si el calendario aprieta (apertura el viernes 23 y primera actividad el sábado
24): `01b` → `03` → la fase de la actividad del sábado (`04` si es cuestionario,
`05` si es código o QR en vivo).

## Reglas comunes a todas las fases

1. **Producción está viva.** Todo cambio de esquema es una migración nueva,
   aditiva y compatible con los datos y el código ya desplegados. Nunca editar
   una migración aplicada.
2. **Migraciones:**
   1. escribir la migración;
   2. `npm run check`;
   3. `npx supabase db push --dry-run`;
   4. mostrar al responsable la lista y el SQL relevante;
   5. **esperar autorización**;
   6. `npx supabase db push`;
   7. verificar con `node scripts/supabase-mgmt.mjs query` (solo lectura) y con
      la clave pública.
3. **Despliegue** (comando en HANDOFF §9): solo con autorización y siempre
   **después** de aplicar las migraciones de las que depende el código. Tras
   desplegar, prueba de humo en `https://piensads.app`.
4. **Módulos incompletos** se ocultan por configuración, nunca con código a
   medio terminar expuesto.
5. **Nunca:**
   - imprimir secretos;
   - desactivar RLS;
   - conceder `INSERT`, `UPDATE` o `DELETE` sobre tablas a `anon` o
     `authenticated`;
   - crear datos ficticios en producción;
   - llamar RPCs que escriben suplantando a un usuario real.
6. **Reutilizar lo que existe** (HANDOFF §5):
   - `private.require_role`, `private.write_audit`,
     `private.current_campaign_id` y `public.is_admin`;
   - las guardas `requireAdminPage` y `requireSessionPage`;
   - el mapeo de errores por lista blanca;
   - `useTransitionForm` (extráelo a `lib/forms` cuando lo uses en otro
     dominio), `CampaignTabs` y `AdminNav`;
   - el sistema visual pixel (`font-display`, `pixel-frame`, `pixel-button`) y
     el renderer de la portada.
7. Cada fase amplía `tests/migrations.test.ts` con las invariantes de sus tablas
   y RPCs, y añade sus tests unitarios.
8. Al terminar, actualizar `docs/HANDOFF.md` (estado, rutas, modelo de datos,
   riesgos) y `README.md`, y hacer commit (sin push salvo autorización).
9. **Entrega:** resumen breve; PASS/FAIL/NOT RUN de lint, typecheck, tests,
   build, dry-run, migración remota, despliegue y prueba de humo; acciones
   manuales pendientes. Después, **DETENTE**.
