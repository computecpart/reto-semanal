# PROMPT 4 — Motor de cuestionarios y revisiones

Actúa como Principal Full-Stack Engineer de este proyecto. Lee `CLAUDE.md`,
`AGENTS.md`, `docs/HANDOFF.md` y `docs/prompts/README.md`. Producción está viva.
Requiere la Fase 3: los puntos se otorgan **solo** con `private.award_points`.

Implementa **exclusivamente** el sistema de cuestionarios. Sin QR.

## 1. Modelo

- `public.quizzes` (por `campaign_id`):
  - `title`, `description`, `image_path` opcional;
  - `opens_at`, `closes_at`, `duration_seconds`;
  - `shuffle_questions`, `shuffle_options`;
  - `results_visibility` (`none`, `score`, `score_and_solutions_after_close`);
  - bono de velocidad: `speed_bonus_enabled`, `speed_bonus_max`,
    `speed_bonus_min`, `speed_fast_threshold_seconds` y
    `speed_window_seconds`;
  - `status` almacenado (`draft`, `scheduled`, `closed`, `archived`);
  - `locked_at`.
- El estado **`active` se deriva** del tiempo: `scheduled` y
  `now() between opens_at and closes_at`. Así no depende de un cron.
- `public.quiz_questions`: `quiz_id`, `position`, `type` (`multiple_choice` u
  `open_text`), `prompt`, `points`, `explanation`, `max_chars` (solo en
  `open_text`).
- `public.quiz_options`: `question_id`, `position`, `label`. Multiple choice
  exige al menos 2 opciones y exactamente una correcta, validado al publicar.
- **Respuestas correctas en `private.quiz_answer_keys`** (`question_id`,
  `correct_option_id`). Nunca en tablas o columnas legibles por clientes. Las
  explicaciones también son privadas hasta que corresponda.
- `public.quiz_attempts`:
  - `unique(quiz_id, user_id)`;
  - `status` (`started`, `submitted`, `submitted_pending_review`, `scored`,
    `expired`, `invalidated`);
  - `started_at` del servidor;
  - `deadline_at = least(closes_at, started_at + duration)`, calculado en el
    servidor;
  - `submitted_at`, `question_order` y `option_order` (orden aleatorio fijado
    al empezar);
  - puntuaciones automática, de revisión y de bono.
- `public.quiz_answers`: una fila por intento y pregunta, guardada por el
  servidor.
- Imagen opcional: bucket `quiz-images` en Storage, lectura pública, escritura
  solo admin por RLS de Storage. Valida tipo (PNG, JPEG, WebP) y tamaño
  (≤ 2 MB).

## 2. Flujo del participante

- `/app/cuestionarios`: disponibles, próximos y finalizados, con su estado.
- `/app/cuestionarios/[id]`:
  - `start_quiz_attempt(quiz_id)` crea el intento (o devuelve el existente) y
    las preguntas **sin información de corrección**, en el orden del intento.
  - `save_quiz_answer(attempt_id, question_id, answer)` es un autoguardado
    rechazado después de `deadline_at`.
  - `submit_quiz_attempt(attempt_id)` es idempotente: un doble submit devuelve
    el resultado existente.
- El temporizador del navegador es solo visual; la autoridad es `deadline_at`.
- **Intentos vencidos sin enviar:** se finalizan de forma perezosa (al
  consultarlos o en un barrido) con las respuestas guardadas antes del plazo y
  estado `expired`. Así se puntúa lo respondido y no se pierde el progreso por
  una desconexión.
- Un participante `suspended` o `disqualified` no puede iniciar intentos.

## 3. Puntuación

- Multiple choice: correcta = puntos de la pregunta; incorrecta o vacía = 0. Sin
  negativos.
- `open_text` queda pendiente de revisión (`submitted_pending_review`).
- **Bono de velocidad**, documentado y con vista previa en el admin antes de
  publicar. Con `t = submitted_at − started_at` en segundos:
  - `t ≤ threshold` → `max`;
  - `t ≥ window` → `min`;
  - en medio, lineal: `max − (max − min)·(t − threshold)/(window − threshold)`.
- **El bono se multiplica por el acierto**: `puntos MC obtenidos / puntos MC
  posibles`. Esto evita que enviar en blanco y rápido dé puntos. Redondea hacia
  abajo a entero. Solo aplica a intentos enviados antes del plazo.
- Se otorga con `award_points`:
  - `kind = quiz`, `source = attempt` para los puntos automáticos;
  - `kind = quiz_speed_bonus` para el bono.
  La idempotencia del ledger impide duplicados.

## 4. Revisiones (`/admin/revisiones`)

- Cola de respuestas abiertas por cuestionario. Opciones: aprobar completa,
  rechazar, puntuación parcial (0–máximo) y nota interna.
- Cada decisión otorga `kind = open_review` con `award_points`, con auditoría.
- Cambiar una decisión ya puntuada crea un evento `correction`
  (`admin_reverse_point_event` + nuevo evento); nunca edita.
- Amplía `is_ranking_provisional`: es `true` si la campaña tiene revisiones
  pendientes.

## 5. Administración (`/admin/cuestionarios`)

- Crear, editar borrador, duplicar, previsualizar (como participante, sin crear
  intento), programar, cerrar y archivar.
- **Bloqueo:** cuando existe el primer intento se fija `locked_at`. Desde ese
  momento un trigger impide cambiar preguntas, opciones, claves, puntos y bono.
  La interfaz ofrece «Duplicar cuestionario».
- Las soluciones se revelan al participante solo según `results_visibility` y
  después de `closes_at`.
- Toda mutación queda auditada.

## 6. Pruebas

- Invariantes SQL:
  - claves solo en `private`;
  - `unique(quiz_id, user_id)`;
  - el trigger de bloqueo;
  - ningún RPC de participante devuelve columnas de corrección.
- Unitarias: fórmula del bono (límites, interpolación, acierto 0) y
  `deadline_at`.
- Integración en Supabase local (si hay Docker): doble submit concurrente,
  respuesta tras el plazo, finalización perezosa y que no se filtren respuestas
  antes del cierre.

Actualiza el handoff y el README, entrega el resumen y **DETENTE**.
