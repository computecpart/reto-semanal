# Entorno local de demostración

Para probar con datos ficticios **sin tocar producción**. Requiere Docker Desktop en marcha.

```bash
npx supabase start                         # levanta Supabase local y aplica todas las migraciones
npx supabase status -o env                 # muestra API_URL, ANON_KEY y SERVICE_ROLE_KEY locales
```

Crea `.env.demo.local` (ignorado por git):

```
SUPABASE_ENVIRONMENT=local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=<SERVICE_ROLE_KEY local>
SUPABASE_PUBLISHABLE_KEY=<ANON_KEY local>
```

```bash
npm run seed:demo
```

El seed se niega a ejecutarse si el destino no es `127.0.0.1`/`localhost`. Crea 1 superadmin, 1 admin y 10
participantes; una campaña publicada con ranking público; 3 trivias (cerrada con intentos, activa y futura) con
respuestas abiertas pendientes y una revisada; 3 misiones (vigente con canjes por código y QR, futura y vencida); un
participante suspendido y otro descalificado. Las credenciales se guardan en `.env.demo.local` y no se imprimen.

Para usar la app contra el entorno local, crea `.env.development.local` con `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` locales (tiene prioridad sobre `.env.local`, que apunta a producción) y
ejecuta `npm run dev`.

```bash
npx supabase stop                          # detener (los datos locales se conservan)
npx supabase db reset                      # recrear la base local desde las migraciones
```
