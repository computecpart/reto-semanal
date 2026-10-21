# Scripts administrativos

Los scripts que usen `SUPABASE_SECRET_KEY` deben vivir aquí, ejecutarse fuera del
runtime web y cargar exclusivamente `.env.seed.local`.

Antes de actuar sobre un proyecto remoto, todo script privilegiado debe validar
con `lib/supabase-target.mjs` que la URL, `SUPABASE_PROJECT_REF` y
`EXPECTED_SUPABASE_PROJECT_REF` apunten al mismo proyecto, exigir
`--confirm=<project-ref>` y rechazar producción salvo `--allow-production`.

| Script | Uso |
| --- | --- |
| `generate-avatars.mjs` | `npm run avatars:generate` regenera `public/avatars/*.svg`. Sin credenciales. |
| `bootstrap-superadmin.mjs` | `npm run bootstrap:superadmin -- --confirm=<ref>` promueve una sola vez al primer superadmin. |
| `check-public-env.mjs` | Se ejecuta antes de `dev`, `build` y `start`; bloquea secretos con prefijo `NEXT_PUBLIC_`. |
