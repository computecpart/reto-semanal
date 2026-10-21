# PROMPT 5 — Recompensas por código manual y QR

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`. Producción está viva.
Requiere la Fase 3: los puntos se otorgan **solo** con `private.award_points`.

Implementa **exclusivamente** recompensas canjeables por código o QR.

## 0. Integración con lo existente

- **Puntos:** solo con `private.award_points(kind = reward, source_type = reward, source_id = reward_id)`.
  Su índice de idempotencia más `unique(user_id, reward_id)` impiden el doble canje.
- **Admin:** cada RPC con `require_role` + `write_audit` (`reward.create`, `reward.code_regenerate`…);
  cada página con `requireAdminPage()`.
- **Navegación:** «Canjear» en `components/app/app-header.tsx`; «Recompensas» en `components/admin/admin-nav.tsx`.
- **Ruta de retorno:** `lib/auth/safe-redirect.ts` solo acepta `/admin` y `/app/perfil`. Amplíalo para
  `/app/canjear?c=CODIGO`, validando el código con el alfabeto y la longitud exactos.
- **La vista de presentación** `/admin/recompensas/[id]/presentar` hereda el layout del admin. Si necesitas
  pantalla completa sin cabecera, crea una ruta fuera de `/admin` (como `/vista-previa`), protegida con
  `requireAdminPage()`, y añádela a `PROTECTED_PATH` y `ADMIN_PATH` en `lib/supabase/proxy.ts`.
- **Logo del QR:** reutiliza el logo del tema de la portada (`landing-assets`) o crea un bucket `branding` con el
  mismo patrón.
- **Coste:** generar el QR en servidor con `qrcode` no usa Image Optimization de Vercel. Mantén `unoptimized`.

## 1. Modelo

- `public.rewards` (por `campaign_id`): `name`, `description`, `points` (> 0),
  `starts_at`, `expires_at`, `enabled` y `created_by`.
- `private.reward_codes`: `reward_id` y `code`, único.
  - Generado con `crypto.getRandomValues` o `gen_random_bytes`.
  - Alfabeto sin ambigüedades `23456789ABCDEFGHJKMNPQRSTUVWXYZ`.
  - Formato `XXXX-XXXX`.
  - Se guarda normalizado: mayúsculas, sin guiones ni espacios.
- `public.reward_redemptions`: `reward_id`, `user_id`, `redeemed_at default
  now()`, `channel` (`manual` o `qr`) y **`unique(user_id, reward_id)`**.
- **Código manual y QR son la misma recompensa.** Canjear por un canal deja el
  otro en 0 puntos adicionales.

## 2. Canje atómico

`redeem_reward(code, channel)`, `security definer`, en una sola transacción:

1. Autenticado, rol `participant` y `participant_can_earn`.
2. Normaliza el código y busca la recompensa con `for update`.
3. Comprueba: campaña publicada, recompensa habilitada y
   `starts_at ≤ now() < expires_at`.
4. Inserta la redención con `on conflict do nothing`. Si no insertó, responde
   «Ya canjeaste esta recompensa».
5. Llama `award_points(kind = reward, source = reward_id)`.

Esto debe sobrevivir a doble clic, dos pestañas y requests simultáneos; lo
garantizan la restricción única y la idempotencia del ledger.

**Anti fuerza bruta:** registra los intentos fallidos en
`private.redeem_attempts` y limita, por ejemplo, a 10 fallos cada 10 minutos por
usuario. Los mensajes de error no deben revelar si un código existe en otra
campaña.

## 3. Participante (`/app/canjear`)

- Dos opciones: escribir el código o escanear un QR.
- **El QR contiene solo una URL propia**: `https://<dominio>/app/canjear?c=CODIGO`.
  Nunca puntos.
- Un GET **nunca** canjea. Flujo: abrir la URL → ver la recompensa y sus puntos →
  botón «Confirmar canje» → server action → RPC. Si no hay sesión, el login
  vuelve a la misma URL. Amplía la lista de rutas permitidas de
  `lib/auth/safe-redirect.ts` de forma segura, conservando solo el parámetro
  del código.
- **Escáner:**
  - Usa `BarcodeDetector` donde exista, con respaldo de `@zxing/browser` en
    versión fijada.
  - La cámara se pide solo tras pulsar «Escanear», con preferencia por la
    trasera, y se detiene al cerrar o al salir de la página.
  - No guarda imágenes.
  - Acepta solo URLs del propio origen con ruta `/app/canjear`; cualquier otra
    cosa muestra «QR no válido» y nunca se abre.
  - Siempre ofrece el ingreso manual.

## 4. Administración (`/admin/recompensas`)

- Crear, editar, activar y desactivar; generar o regenerar el código (la
  regeneración se audita); listar canjes y exportarlos a CSV.
- **QR:**
  - Generado en servidor con la librería `qrcode` (versión fijada), en SVG y PNG.
  - Corrección de errores `H` cuando lleva logo (`M` sin logo) y quiet zone de
    4 módulos.
  - Logo central ≤ 20 % del área. Siempre hay una versión sin logo.
- **Logo de marca:**
  - Bucket `branding` de Storage, escritura solo admin.
  - Solo PNG, JPEG o WebP (validando los bytes mágicos, no solo la extensión) y
    ≤ 1 MB.
  - Reprocesa con `sharp` para eliminar metadatos.
- **Vista de presentación** `/admin/recompensas/[id]/presentar`: pantalla
  completa con el QR grande, el código escrito, los puntos y la vigencia en la
  zona operativa. Ideal para un live; sin elementos de navegación.
- Toda mutación queda auditada.

## 5. Pruebas

- Invariantes SQL:
  - `unique(user_id, reward_id)`;
  - códigos solo en `private`;
  - sin grants de escritura a clientes.
- Unitarias: generador (alfabeto, longitud, entropía), normalización y
  validación de URL del escáner.
- Integración en Supabase local (si hay Docker):
  - canje concurrente (N requests → 1 redención y 1 evento);
  - manual y después QR = 0 puntos extra;
  - recompensa futura, vencida o deshabilitada;
  - participante descalificado;
  - límite de intentos.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
