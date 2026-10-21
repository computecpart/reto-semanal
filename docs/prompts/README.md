# Prompts de las fases siguientes

Ejecuta **una fase por sesión**, en este orden, y detente al terminar cada una.
Antes de cada fase, Claude Code carga `CLAUDE.md`, que incluye `AGENTS.md` y
`docs/HANDOFF.md`.

| Archivo | Fase | Depende de |
| --- | --- | --- |
| `01b-despliegue-produccion.md` | Cerrar despliegue, dominio y SMTP (si quedó pendiente) | 0, 1 |
| `02-campana-landing-reglas.md` | Campañas, portada, reglas versionadas, auditoría base, sistema visual | 1 |
| `03-puntos-ranking.md` | Ledger de puntos, estado del participante, ranking | 2 |
| `04-cuestionarios.md` | Motor de cuestionarios y revisiones | 3 |
| `05-recompensas-qr.md` | Códigos manuales y QR | 3 |
| `06-moderacion-admin.md` | Moderación, administradores, panel de auditoría | 3 (mejor tras 4 y 5) |
| `07-qa-pulido.md` | QA, accesibilidad, seed local, documentación | 2–6 |
| `08-operacion-produccion.md` | Endurecimiento y operación de la campaña | 7 |

Cambios respecto al plan original:

- **Los puntos van antes que cuestionarios y recompensas.** Ambos módulos
  otorgan puntos, así que necesitan el ledger.
- **La auditoría general nace en la Fase 2**, porque los cambios de campaña y de
  reglas ya deben quedar registrados. El panel de consulta llega en la Fase 6.
- **El estado del participante** (`active`, `suspended`, `disqualified`,
  `archived`) se crea en la Fase 3, porque el ranking y los canjes dependen de
  él. La interfaz de moderación llega en la Fase 6.
- **El seed demo solo se ejecuta contra Supabase local.** El único proyecto
  remoto es producción.

Si el calendario aprieta (apertura el viernes y primera actividad el sábado),
el orden mínimo es: `01b` → `02` → `03` → la fase de la actividad del sábado
(`04` si es cuestionario, `05` si es código/QR en vivo).

## Reglas comunes a todas las fases

1. **Producción está viva.** Hay usuarios reales. Todo cambio de esquema es una
   migración nueva, aditiva y compatible con los datos y el código ya desplegados.
2. **Migraciones:** escribir → `npm run check` → `npx supabase db push --dry-run`
   → mostrar el SQL y la lista al responsable → **esperar autorización** →
   `npx supabase db push` → verificar con `node scripts/supabase-mgmt.mjs query`.
3. **Despliegue:** solo con autorización explícita, después de aplicar las
   migraciones de las que depende el código.
4. **Módulos incompletos** se ocultan con configuración (p. ej. estado de
   campaña o un ajuste de visibilidad), nunca con código a medio terminar
   expuesto.
5. **Nunca** imprimir secretos, desactivar RLS, conceder escritura directa sobre
   tablas a `anon`/`authenticated`, ni crear datos ficticios en producción.
6. Respetar las convenciones de `docs/HANDOFF.md` §4: RPC `security definer`
   con `search_path = ''`, guardas de servidor, mapeo de errores por lista
   blanca, formularios con `startTransition`, fechas operativas y tests de
   invariantes SQL.
7. Cada fase amplía `tests/migrations.test.ts` con las invariantes de sus tablas
   y RPCs.
8. Al terminar, actualizar `docs/HANDOFF.md` (estado, modelo de datos, riesgos)
   y `README.md`.
9. **Entrega:** resumen breve; lista PASS/FAIL/NOT RUN de lint, typecheck,
   tests, build, dry-run y verificación remota; instrucciones manuales si las
   hay. Después, **DETENTE**.
